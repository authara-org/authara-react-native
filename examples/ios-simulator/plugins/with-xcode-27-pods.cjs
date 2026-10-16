const { createRunOncePlugin, withPodfile } = require("@expo/config-plugins");

const helper = `
def authara_raise_pod_deployment_targets(installer)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      configured = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
      if configured.nil? || Gem::Version.new(configured) < Gem::Version.new('15.1')
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
      end
    end
  end
end
`;

function withXcode27Pods(config) {
  return withPodfile(config, (podfile) => {
    let contents = podfile.modResults.contents;
    if (!contents.includes("def authara_raise_pod_deployment_targets")) {
      contents = contents.replace(
        "prepare_react_native_project!\n",
        `prepare_react_native_project!\n${helper}`,
      );
    }
    if (
      !contents.includes("    authara_raise_pod_deployment_targets(installer)")
    ) {
      contents = contents.replace(
        /(    react_native_post_install\([\s\S]*?^    \)\n)/m,
        "$1    authara_raise_pod_deployment_targets(installer)\n",
      );
    }
    podfile.modResults.contents = contents;
    return podfile;
  });
}

module.exports = createRunOncePlugin(
  withXcode27Pods,
  "authara-xcode-27-pods",
  "1.0.0",
);
