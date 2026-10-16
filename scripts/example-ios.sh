#!/usr/bin/env bash
set -euo pipefail

sdk_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
example_dir="$sdk_dir/examples/ios-simulator"
mode="${1:-native}"

bash "$sdk_dir/scripts/example-core.sh" up

if ! test -x "$sdk_dir/node_modules/.bin/tsc" || \
  ! test -f "$sdk_dir/node_modules/react-native-svg/package.json"; then
  npm --prefix "$sdk_dir" install --no-audit --no-fund
fi
npm --prefix "$sdk_dir" run build

if ! test -x "$example_dir/node_modules/.bin/expo" || \
  ! test -f "$example_dir/node_modules/react-native-svg/package.json"; then
  npm --prefix "$example_dir" install --no-audit --no-fund
fi

xcode_major="$(xcodebuild -version | awk 'NR == 1 { split($2, version, "."); print version[1] }')"

run_with_device_hub() {
  local device_info device_id device_state derived_data app_path app_id metro_pid workspace_path scheme

  device_info="$(AUTHARA_IOS_DEVICE="${AUTHARA_IOS_DEVICE:-}" node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      const runtimes = Object.values(JSON.parse(input).devices);
      const devices = runtimes.flat().filter(device => device.isAvailable && device.name.startsWith("iPhone"));
      const requested = process.env.AUTHARA_IOS_DEVICE;
      const selected = requested
        ? devices.find(device => device.name === requested || device.udid === requested)
        : devices.find(device => device.state === "Booted") ?? devices[0];
      if (!selected) process.exit(1);
      process.stdout.write(`${selected.udid} ${selected.state}`);
    });
  ' < <(xcrun simctl list devices available --json))" || {
    echo "No available iPhone Simulator runtime was found." >&2
    exit 1
  }

  device_id="${device_info%% *}"
  device_state="${device_info#* }"
  if test "$device_state" != Booted; then
    xcrun simctl boot "$device_id"
  fi
  xcrun simctl bootstatus "$device_id" -b
  open -a DeviceHub

  (
    cd "$example_dir"
    npx expo prebuild --platform ios
  )

  if ! command -v pod >/dev/null 2>&1; then
    echo "CocoaPods is required to build the iOS development app." >&2
    exit 1
  fi
  (
    cd "$example_dir/ios"
    pod install
  )

  workspace_path=("$example_dir"/ios/*.xcworkspace)
  if test "${#workspace_path[@]}" -ne 1 || ! test -d "${workspace_path[0]}"; then
    echo "Expected one generated iOS workspace under $example_dir/ios." >&2
    exit 1
  fi
  workspace_path="${workspace_path[0]}"
  scheme="$(basename "$workspace_path" .xcworkspace)"
  derived_data="$example_dir/.expo/ios-derived-data"
  xcodebuild \
    -workspace "$workspace_path" \
    -scheme "$scheme" \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination "id=$device_id" \
    -derivedDataPath "$derived_data" \
    COMPILER_INDEX_STORE_ENABLE=NO \
    -quiet \
    build

  app_path="$derived_data/Build/Products/Debug-iphonesimulator/$scheme.app"
  xcrun simctl install "$device_id" "$app_path"
  app_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app_path/Info.plist")"

  metro_pid=""
  if ! curl --fail --silent http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
    npm --prefix "$example_dir" start -- --localhost &
    metro_pid=$!
    trap 'kill "$metro_pid" 2>/dev/null || true' EXIT INT TERM
    for _ in {1..30}; do
      if curl --fail --silent http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
        break
      fi
      if ! kill -0 "$metro_pid" 2>/dev/null; then
        wait "$metro_pid"
      fi
      sleep 1
    done
    if ! curl --fail --silent http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
      echo "Metro did not become ready within 30 seconds." >&2
      exit 1
    fi
  fi

  xcrun simctl launch --terminate-running-process "$device_id" "$app_id"
  echo "Authara Local is running in Device Hub on $device_id."

  if test -n "$metro_pid"; then
    wait "$metro_pid"
  fi
}

case "$mode" in
  native)
    if test "$xcode_major" -ge 27; then
      run_with_device_hub
    else
      npm --prefix "$example_dir" run ios
    fi
    ;;
  go)
    if test "$xcode_major" -ge 27; then
      echo "Expo SDK 54's Expo Go launcher does not support Xcode 27 Device Hub." >&2
      echo "Use npm run example:ios for the native development build." >&2
      exit 1
    else
      npm --prefix "$example_dir" run ios:go
    fi
    ;;
  *)
    echo "Usage: $0 [native|go]" >&2
    exit 2
    ;;
esac
