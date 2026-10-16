import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AutharaApiError,
  useAuthara,
  type Capabilities,
  type CurrentOrganizationMember,
  type InvitationPreview,
  type MembershipWithOrganization,
  type Organization,
  type OrganizationInvitation,
  type OrganizationMember,
  type OrganizationSummary,
} from "@authara/react-native";

import { ReauthenticationCard } from "./ReauthenticationCard";
import { colors, radius, typography } from "./theme";
import {
  Card,
  DataRow,
  ErrorBanner,
  Field,
  Pill,
  PrimaryButton,
  ScreenReveal,
  SecondaryButton,
  SectionHeading,
  SuccessBanner,
} from "./ui";

function messageFor(error: unknown): string {
  if (error instanceof AutharaApiError) {
    return error.code ? `${error.code}: ${error.message}` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export function OrganizationsScreen() {
  const { client, user } = useAuthara();
  const [capabilities, setCapabilities] = useState<Capabilities>();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [current, setCurrent] = useState<OrganizationSummary>();
  const [currentMembers, setCurrentMembers] = useState<
    CurrentOrganizationMember[]
  >([]);
  const [memberships, setMemberships] = useState<MembershipWithOrganization[]>(
    [],
  );
  const [selected, setSelected] = useState<Organization>();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [selectedMember, setSelectedMember] = useState<OrganizationMember>();
  const [selectedInvitation, setSelectedInvitation] =
    useState<OrganizationInvitation>();
  const [organizationName, setOrganizationName] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [invitationPreview, setInvitationPreview] =
    useState<InvitationPreview>();
  const [accountMethods, setAccountMethods] = useState(new Set<string>());
  const [challengeID, setChallengeID] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const retryAfterReauthentication = useRef<(() => Promise<void>) | undefined>(
    undefined,
  );

  const loadOrganization = useCallback(
    async (organizationID: string, publicManagement: boolean) => {
      if (!publicManagement) return;
      const [organization, organizationMembers, organizationInvitations] =
        await Promise.all([
          client.getPublicOrganization({ organizationID }),
          client.listPublicOrganizationMembers({ organizationID, limit: 50 }),
          client.listPublicOrganizationInvitations({
            organizationID,
            limit: 50,
          }),
        ]);
      setSelected(organization.organization);
      setOrganizationName(organization.organization.name);
      setMembers(organizationMembers.members);
      setInvitations(organizationInvitations.invitations);
      setSelectedMember(undefined);
      setSelectedInvitation(undefined);
    },
    [client],
  );

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const [
        nextCapabilities,
        nextOrganizations,
        nextCurrent,
        nextMembers,
        account,
      ] = await Promise.all([
        client.getPublicCapabilities(),
        client.listCurrentUserOrganizations({ limit: 50 }),
        client.getCurrentOrganization(),
        client.listCurrentOrganizationMembers({ limit: 50 }),
        client.getCurrentAccount({ sessions_limit: 1, passkeys_limit: 1 }),
      ]);
      setCapabilities(nextCapabilities);
      setOrganizations(nextOrganizations.organizations);
      setCurrent(nextCurrent);
      setCurrentMembers(nextMembers.members);
      setAccountMethods(
        new Set(account.auth_methods.map((method) => method.provider)),
      );
      if (user?.id) {
        try {
          const nextMemberships = await client.listPublicUserMemberships({
            userID: user.id,
            limit: 50,
          });
          setMemberships(nextMemberships.memberships);
        } catch (caught) {
          if (!(caught instanceof AutharaApiError && caught.status === 404)) {
            throw caught;
          }
          setMemberships([]);
        }
      }
      if (nextCapabilities.allows_public_organization_management) {
        await loadOrganization(nextCurrent.id, true);
      } else {
        setSelected(undefined);
        setMembers([]);
        setInvitations([]);
      }
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }, [client, loadOrganization, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const runProtected = async (
    name: string,
    action: () => Promise<unknown>,
    done: string,
  ) => {
    setPending(name);
    setError(undefined);
    setSuccess(undefined);
    try {
      await action();
      setSuccess(done);
      await load();
    } catch (caught) {
      if (
        caught instanceof AutharaApiError &&
        caught.details?.authentication_challenge?.id
      ) {
        retryAfterReauthentication.current = () =>
          runProtected(name, action, done);
        setChallengeID(caught.details.authentication_challenge.id);
      } else {
        setError(messageFor(caught));
      }
    } finally {
      setPending(undefined);
    }
  };

  const finishReauthentication = async () => {
    const retry = retryAfterReauthentication.current;
    retryAfterReauthentication.current = undefined;
    setChallengeID(undefined);
    if (retry) await retry();
  };

  const switchOrganization = (organization: OrganizationSummary) =>
    runProtected(
      `switch-${organization.id}`,
      () =>
        client.switchOrganization({
          organizationID: organization.id,
          audience: "app",
        }),
      `You are now working in ${organization.name}.`,
    );

  const previewInvitation = async () => {
    setPending("preview");
    setError(undefined);
    try {
      setInvitationPreview(
        await client.previewInvitation({ token: invitationToken.trim() }),
      );
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPending(undefined);
    }
  };

  const acceptInvitation = async () => {
    setPending("accept");
    setError(undefined);
    try {
      await client.acceptInvitation({
        audience: "app",
        body: { token: invitationToken.trim() },
      });
      setInvitationToken("");
      setInvitationPreview(undefined);
      setSuccess("Invitation accepted. Your new workspace is ready.");
      await load();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPending(undefined);
    }
  };

  const openMember = async (member: OrganizationMember) => {
    if (!selected) return;
    setPending(`member-${member.user_id}`);
    try {
      const result = await client.getPublicOrganizationMember({
        organizationID: selected.id,
        userID: member.user_id,
      });
      setSelectedMember(result.member);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPending(undefined);
    }
  };

  const openInvitation = async (invitation: OrganizationInvitation) => {
    if (!selected) return;
    setPending(`invite-${invitation.id}`);
    try {
      const result = await client.getPublicOrganizationInvitation({
        organizationID: selected.id,
        invitationID: invitation.id,
      });
      setSelectedInvitation(result.invitation);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPending(undefined);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            setLoading(true);
            void load();
          }}
          tintColor={colors.accent}
        />
      }
    >
      <ScreenReveal>
        <View style={styles.hero}>
          <Pill label={current?.role ?? "Workspace"} tone="success" />
          <Text style={styles.title}>{current?.name ?? "Your workspaces"}</Text>
          <Text style={styles.subtitle}>
            Switch teams, review membership, manage roles, and handle pending
            invitations from one place.
          </Text>
        </View>

        {error ? <ErrorBanner message={error} /> : null}
        {success ? <SuccessBanner message={success} /> : null}
        {challengeID ? (
          <View style={styles.section}>
            <ReauthenticationCard
              challengeID={challengeID}
              methods={accountMethods}
              onSuccess={() => void finishReauthentication()}
              onError={(caught) => setError(messageFor(caught))}
              onCancel={() => {
                retryAfterReauthentication.current = undefined;
                setChallengeID(undefined);
              }}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeading
            title="Workspaces"
            detail={`${organizations.length} available · ${capabilities?.organization_mode ?? "loading"} organization mode`}
          />
          <View style={styles.list}>
            {organizations.map((organization) => (
              <Pressable
                key={organization.id}
                accessibilityRole="button"
                onPress={() =>
                  void loadOrganization(
                    organization.id,
                    Boolean(
                      capabilities?.allows_public_organization_management,
                    ),
                  ).catch((caught) => setError(messageFor(caught)))
                }
                style={({ pressed }) => [
                  styles.organization,
                  organization.id === selected?.id &&
                    styles.organizationSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.organizationCopy}>
                  <Text style={styles.itemTitle}>{organization.name}</Text>
                  <Text style={styles.itemDetail}>{organization.role}</Text>
                </View>
                {organization.id === current?.id ? (
                  <Pill label="Current" tone="success" />
                ) : (
                  <SecondaryButton
                    label={
                      pending === `switch-${organization.id}`
                        ? "Switching…"
                        : "Switch"
                    }
                    disabled={
                      pending !== undefined ||
                      !capabilities?.allows_org_switching
                    }
                    onPress={() => void switchOrganization(organization)}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {selected && capabilities?.allows_public_organization_management ? (
          <>
            <View style={styles.section}>
              <SectionHeading
                title="Workspace settings"
                detail="Owners and admins can keep the public organization profile current."
              />
              <Card tone="raised">
                <View style={styles.form}>
                  <Field
                    label="Workspace name"
                    value={organizationName}
                    onChangeText={setOrganizationName}
                    placeholder="Workspace name"
                  />
                  <PrimaryButton
                    label={
                      pending === "rename-org"
                        ? "Saving…"
                        : "Save workspace name"
                    }
                    disabled={
                      pending !== undefined ||
                      !organizationName.trim() ||
                      organizationName.trim() === selected.name
                    }
                    onPress={() =>
                      void runProtected(
                        "rename-org",
                        () =>
                          client.updatePublicOrganization({
                            organizationID: selected.id,
                            body: { name: organizationName.trim() },
                          }),
                        "Workspace name updated.",
                      )
                    }
                  />
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <SectionHeading
                title="Members"
                detail="Open a member to review their account and change their role."
              />
              <View style={styles.list}>
                {members.map((member) => (
                  <Card key={member.user_id}>
                    <View style={styles.row}>
                      <View style={styles.organizationCopy}>
                        <Text style={styles.itemTitle}>
                          {member.username || member.email}
                        </Text>
                        <Text style={styles.itemDetail}>{member.email}</Text>
                      </View>
                      <Pill label={member.role} />
                    </View>
                    <SecondaryButton
                      label={
                        pending === `member-${member.user_id}`
                          ? "Opening…"
                          : "Manage member"
                      }
                      disabled={pending !== undefined}
                      onPress={() => void openMember(member)}
                    />
                  </Card>
                ))}
              </View>
              {selectedMember ? (
                <Card tone="raised">
                  <View style={styles.form}>
                    <DataRow label="Member" value={selectedMember.email} />
                    <DataRow label="Role" value={selectedMember.role} />
                    {selectedMember.role !== "owner" ? (
                      <PrimaryButton
                        label={
                          pending === "role"
                            ? "Saving…"
                            : `Make ${selectedMember.role === "admin" ? "member" : "admin"}`
                        }
                        disabled={pending !== undefined}
                        onPress={() =>
                          void runProtected(
                            "role",
                            () =>
                              client.updatePublicOrganizationMember({
                                organizationID: selected.id,
                                userID: selectedMember.user_id,
                                body: {
                                  role:
                                    selectedMember.role === "admin"
                                      ? "member"
                                      : "admin",
                                },
                              }),
                            `${selectedMember.username || selectedMember.email}'s role was updated.`,
                          )
                        }
                      />
                    ) : null}
                    <SecondaryButton
                      label="Close"
                      onPress={() => setSelectedMember(undefined)}
                    />
                  </View>
                </Card>
              ) : null}
            </View>

            <View style={styles.section}>
              <SectionHeading
                title="Pending invitations"
                detail="Review or revoke invitations that should no longer grant access."
              />
              <View style={styles.list}>
                {invitations.length ? (
                  invitations.map((invitation) => (
                    <Card key={invitation.id}>
                      <View style={styles.row}>
                        <View style={styles.organizationCopy}>
                          <Text style={styles.itemTitle}>
                            {invitation.email}
                          </Text>
                          <Text style={styles.itemDetail}>
                            {invitation.role} · {invitation.status}
                          </Text>
                        </View>
                        <SecondaryButton
                          label={
                            pending === `invite-${invitation.id}`
                              ? "Opening…"
                              : "Review"
                          }
                          disabled={pending !== undefined}
                          onPress={() => void openInvitation(invitation)}
                        />
                      </View>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <Text style={styles.empty}>
                      No invitations are pending.
                    </Text>
                  </Card>
                )}
              </View>
              {selectedInvitation ? (
                <Card tone="raised">
                  <View style={styles.form}>
                    <DataRow
                      label="Recipient"
                      value={selectedInvitation.email}
                    />
                    <DataRow label="Status" value={selectedInvitation.status} />
                    <DataRow label="Role" value={selectedInvitation.role} />
                    {selectedInvitation.status === "pending" ? (
                      <SecondaryButton
                        label={
                          pending === "revoke-invite"
                            ? "Revoking…"
                            : "Revoke invitation"
                        }
                        danger
                        disabled={pending !== undefined}
                        onPress={() =>
                          void runProtected(
                            "revoke-invite",
                            () =>
                              client.revokePublicOrganizationInvitation({
                                organizationID: selected.id,
                                invitationID: selectedInvitation.id,
                              }),
                            `Invitation for ${selectedInvitation.email} revoked.`,
                          )
                        }
                      />
                    ) : null}
                    <SecondaryButton
                      label="Close"
                      onPress={() => setSelectedInvitation(undefined)}
                    />
                  </View>
                </Card>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.section}>
            <SectionHeading
              title="Current team"
              detail="People in your active workspace."
            />
            <Card>
              {currentMembers.map((member, index) => (
                <DataRow
                  key={member.user_id}
                  label={member.username || member.email}
                  value={member.role}
                  last={index === currentMembers.length - 1}
                />
              ))}
            </Card>
          </View>
        )}

        <View style={styles.section}>
          <SectionHeading
            title="Join another workspace"
            detail="Paste the token from an Authara invitation link before accepting it."
          />
          <Card tone="raised">
            <View style={styles.form}>
              <Field
                label="Invitation token"
                value={invitationToken}
                onChangeText={(value) => {
                  setInvitationToken(value);
                  setInvitationPreview(undefined);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Paste invitation token"
              />
              {invitationPreview ? (
                <View style={styles.preview}>
                  <Text style={styles.itemTitle}>
                    {invitationPreview.organization.name}
                  </Text>
                  <Text style={styles.itemDetail}>
                    Join as {invitationPreview.invitation.role} using{" "}
                    {invitationPreview.invitation.email}
                  </Text>
                </View>
              ) : null}
              <PrimaryButton
                label={
                  pending === "preview"
                    ? "Checking…"
                    : invitationPreview
                      ? pending === "accept"
                        ? "Joining…"
                        : "Accept invitation"
                      : "Review invitation"
                }
                disabled={pending !== undefined || !invitationToken.trim()}
                onPress={() =>
                  void (invitationPreview
                    ? acceptInvitation()
                    : previewInvitation())
                }
              />
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeading
            title="Your membership history"
            detail="All organizations connected to this account."
          />
          <Card>
            {memberships.length ? (
              memberships.map((membership, index) => (
                <DataRow
                  key={membership.organization.id}
                  label={membership.organization.name}
                  value={membership.membership.role}
                  last={index === memberships.length - 1}
                />
              ))
            ) : (
              <Text style={styles.empty}>
                No additional membership records.
              </Text>
            )}
          </Card>
        </View>
      </ScreenReveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 34, paddingBottom: 80, gap: 16 },
  hero: { gap: 14, marginBottom: 20 },
  title: {
    color: colors.text,
    fontFamily: typography.display,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
    lineHeight: 40,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  section: { marginTop: 24 },
  list: { gap: 10 },
  form: { gap: 15 },
  organization: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
  organizationSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
  },
  organizationCopy: { flex: 1, gap: 3 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  itemTitle: {
    color: colors.text,
    fontFamily: typography.body,
    fontSize: 15,
    fontWeight: "700",
  },
  itemDetail: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
  },
  preview: {
    gap: 4,
    padding: 14,
    borderRadius: radius.medium,
    backgroundColor: colors.ink,
  },
  empty: { color: colors.muted, fontFamily: typography.body, fontSize: 13 },
  pressed: { opacity: 0.75 },
});
