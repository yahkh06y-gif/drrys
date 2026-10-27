// Study together: the Study Squad (4 friends → 25% off Pro each) and "invite a friend → a free 2nd branch".
// Everything is checked by the database (see src/lib/together.ts); this screen only shows and shares it.
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COCO } from "@/art";
import {
  Btn,
  Coco,
  Confirm,
  Enter,
  IconBtn,
  Progress,
  T,
} from "@/components/ui";
import { cloudEnabled } from "@/lib/cloud";
import { haptic, play, tap } from "@/lib/feedback";
import {
  APP_LINK,
  friendBranches,
  leaveSquad,
  MAX_OFF,
  myInviteCode,
  redeemCode,
  refreshTogether,
  SQUAD_OFF,
  SQUAD_SIZE,
  startSquad,
} from "@/lib/together";
import { useApp } from "@/store";
import { color } from "@/design/tokens";
import { C, F } from "@/theme";

export default function Together() {
  const signedIn = useApp((s) => !!s.profile.uid);
  const isPro = useApp((s) => s.isPro);
  const t = useApp((s) => s.together);
  const [busy, setBusy] = useState<"squad" | "code" | "use" | undefined>();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [askLeave, setAskLeave] = useState(false);

  // fresh numbers every time the screen opens (a friend may have joined meanwhile)
  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return;
      refreshTogether().then((x) => {
        if (x && !x.code) myInviteCode().catch(() => {});
      });
    }, [signedIn]),
  );

  const squad = t?.squad;
  const count = squad?.members.length ?? 0;
  const full = count >= SQUAD_SIZE;
  const branchUnlocked = friendBranches(t) >= 1;

  const share = (text: string) => {
    tap();
    Share.share({ message: text }).catch(() => {});
  };

  const createSquad = async () => {
    setBusy("squad");
    try {
      await startSquad();
      play("select");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(undefined);
  };

  const use = async () => {
    setBusy("use");
    setMsg(undefined);
    try {
      const r = await redeemCode(code);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        setCode("");
        play("celebrate");
        haptic("success");
      } else haptic("error");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(undefined);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        <IconBtn name="arrow-back" onPress={() => router.back()} />
        <T v="h3" style={{ color: C.teal }}>
          Study together
        </T>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
      >
        <Enter style={{ alignItems: "center", gap: 4 }}>
          <Coco src={COCO.hi} size={100} />
          <T style={{ textAlign: "center" }}>
            Forests grow better together. Bring your classmates and Drrys gets
            better for all of you.
          </T>
        </Enter>

        {!signedIn ? (
          <Card>
            <Text style={{ fontFamily: F.semi, fontSize: 16, color: C.ink }}>
              Sign in to study together
            </Text>
            <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.body }}>
              Squads and invites belong to your account, so friends can find
              you.{" "}
              {cloudEnabled ? "" : "Accounts aren’t switched on in this build."}
            </Text>
            {cloudEnabled && (
              <Btn
                title="Sign in"
                kind="green"
                height={48}
                onPress={() => router.push("/account")}
              />
            )}
          </Card>
        ) : (
          <>
            {/* Study Squad */}
            <Card>
              <Head
                emoji="👥"
                title="Study Squad"
                tag={full && !isPro ? `${SQUAD_OFF}% OFF` : `${count}/${SQUAD_SIZE}`}
              />
              <Text
                style={{ fontFamily: F.medium, fontSize: 13, color: C.body }}
              >
                {isPro
                  ? `${SQUAD_SIZE} friends, one code. You're already Pro, so the discount is for your friends: when the squad is full, each of them gets ${SQUAD_OFF}% off Pro.`
                  : `${SQUAD_SIZE} friends, one code. When your squad is full, each of you gets ${SQUAD_OFF}% off Pro. It stacks with your streak reward, up to ${MAX_OFF}% off.`}
              </Text>
              {!squad ? (
                <Btn
                  title="Start a squad"
                  kind="green"
                  height={48}
                  icon="people"
                  loading={busy === "squad"}
                  onPress={createSquad}
                />
              ) : (
                <>
                  <CodeBox
                    code={squad.code}
                    onShare={() =>
                      share(
                        `Join my study squad on Drrys 🌳 When we're ${SQUAD_SIZE}, we all get ${SQUAD_OFF}% off Drrys Pro.\n\n1. Get Drrys: ${APP_LINK}\n2. Profile → Study together → enter my code: ${squad.code}`,
                      )
                    }
                  />
                  <View style={{ gap: 6 }}>
                    {Array.from(
                      { length: SQUAD_SIZE },
                      (_, k) => squad.members[k],
                    ).map((m, k) => (
                      <View
                        key={k}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 15,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: m ? C.mint : C.sand,
                            borderWidth: 1,
                            borderColor: m ? C.mintBorder : C.line,
                          }}
                        >
                          {m ? (
                            <Text
                              style={{
                                fontFamily: F.bold,
                                fontSize: 13,
                                color: C.moss,
                              }}
                            >
                              {(m.name || "?")[0].toUpperCase()}
                            </Text>
                          ) : (
                            <Ionicons
                              name="person-add-outline"
                              size={14}
                              color={C.muted}
                            />
                          )}
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            fontFamily: m ? F.bold : F.medium,
                            fontSize: 14,
                            color: m ? C.ink : C.muted,
                          }}
                        >
                          {m
                            ? `${m.name || "Student"}${m.me ? " (you)" : ""}`
                            : "Waiting for a friend…"}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Progress
                    value={count / SQUAD_SIZE}
                    height={6}
                    track={C.track}
                    fill={C.teal}
                  />
                  <Text
                    style={{
                      fontFamily: F.bold,
                      fontSize: 13,
                      color: full ? C.leaf : C.orange,
                    }}
                  >
                    {full
                      ? isPro
                        ? `Squad complete! Your friends now get ${SQUAD_OFF}% off Pro.`
                        : `Squad complete! ${SQUAD_OFF}% off Pro is unlocked for all of you.`
                      : `${SQUAD_SIZE - count} more ${SQUAD_SIZE - count === 1 ? "friend" : "friends"} to unlock ${SQUAD_OFF}% off${isPro ? " for your friends" : ""}.`}
                  </Text>
                  {full && !isPro && (
                    <Btn
                      title="See my price"
                      kind="green"
                      height={46}
                      icon="arrow-forward"
                      onPress={() => router.push("/paywall")}
                    />
                  )}
                  <Pressable
                    onPress={() => setAskLeave(true)}
                    style={{ alignSelf: "center", padding: 4 }}
                  >
                    <Text
                      style={{
                        fontFamily: F.bold,
                        fontSize: 12,
                        color: C.muted,
                      }}
                    >
                      Leave squad
                    </Text>
                  </Pressable>
                </>
              )}
            </Card>

            {/* Invite a friend: free students only (Pro already has every branch) */}
            {!isPro && (
              <Card>
                <Head
                  emoji="🌿"
                  title="Invite a friend"
                  tag={branchUnlocked ? "UNLOCKED" : undefined}
                />
                <Text
                  style={{ fontFamily: F.medium, fontSize: 13, color: C.body }}
                >
                  When a friend joins with your code and finishes their first
                  session, your trees get a free 2nd branch.
                </Text>
                {t?.code ? (
                  <CodeBox
                    code={t.code}
                    onShare={() =>
                      share(
                        `I grow my subjects like trees on Drrys 🌳 Study with me!\n\n1. Get Drrys: ${APP_LINK}\n2. Profile → Study together → enter my code: ${t.code}`,
                      )
                    }
                  />
                ) : (
                  <Btn
                    title="Get my invite code"
                    kind="green"
                    height={46}
                    loading={busy === "code"}
                    onPress={async () => {
                      setBusy("code");
                      await myInviteCode().catch((e) =>
                        setMsg({ ok: false, text: (e as Error).message }),
                      );
                      setBusy(undefined);
                    }}
                  />
                )}
                {branchUnlocked ? (
                  <Text
                    style={{ fontFamily: F.bold, fontSize: 13, color: C.leaf }}
                  >
                    ✓ Your trees can now have 2 branches on the free plan.
                  </Text>
                ) : t?.pending ? (
                  <Text
                    style={{
                      fontFamily: F.bold,
                      fontSize: 13,
                      color: C.orange,
                    }}
                  >
                    {t.pending}{" "}
                    {t.pending === 1 ? "friend joined" : "friends joined"},
                    waiting for their first session.
                  </Text>
                ) : null}
              </Card>
            )}

            {/* use a friend's code */}
            <Card>
              <Head emoji="🔑" title="Got a code from a friend?" />
              <View
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                <TextInput
                  value={code}
                  onChangeText={(v) => setCode(v.toUpperCase())}
                  placeholder="ABC123"
                  placeholderTextColor={C.mutedLight}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                  onSubmitEditing={code.trim().length >= 6 ? use : undefined}
                  style={{
                    flex: 1,
                    backgroundColor: C.white,
                    borderWidth: 1.5,
                    borderColor: C.teal,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontFamily: F.bold,
                    fontSize: 16,
                    letterSpacing: 3,
                    color: C.ink,
                  }}
                />
                <Btn
                  title="Use"
                  kind="green"
                  height={48}
                  style={{ width: 90 }}
                  loading={busy === "use"}
                  disabled={code.trim().length < 6}
                  onPress={use}
                />
              </View>
              <Text
                style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}
              >
                Works for squad codes and invite codes.
              </Text>
            </Card>
            {!!msg && (
              <Text
                style={{
                  fontFamily: F.bold,
                  fontSize: 13,
                  color: msg.ok ? C.leaf : C.red,
                  textAlign: "center",
                }}
              >
                {msg.text}
              </Text>
            )}
          </>
        )}
      </ScrollView>
      <Confirm
        visible={askLeave}
        title="Leave the squad?"
        body={
          full
            ? `Your friends lose the full-squad ${SQUAD_OFF}% off until someone takes your place.`
            : "You can join another squad afterwards."
        }
        yes="Leave"
        no="Stay"
        onNo={() => setAskLeave(false)}
        onYes={async () => {
          setAskLeave(false);
          await leaveSquad().catch((e) => setMsg({ ok: false, text: (e as Error).message }));
        }}
      />
    </SafeAreaView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: C.white,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: C.barkSoft,
        padding: 16,
        gap: 10,
      }}
    >
      {children}
    </View>
  );
}

// the card headings use line icons, not emoji (same family as the rest of the app)
const HEAD_ICON: Record<string, keyof typeof Ionicons.glyphMap> = { "👥": "people-outline", "🌿": "git-branch-outline", "🔑": "key-outline" };

function Head({
  emoji,
  title,
  tag,
}: {
  emoji: string;
  title: string;
  tag?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {HEAD_ICON[emoji] ? (
        <Ionicons name={HEAD_ICON[emoji]} size={20} color={C.teal} />
      ) : (
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      )}
      <Text style={{ flex: 1, fontFamily: F.semi, fontSize: 17, color: C.ink }}>
        {title}
      </Text>
      {!!tag && (
        <Text
          style={{
            fontFamily: F.medium,
            fontSize: 12,
            color: color.selected.text,
            backgroundColor: color.selected.bg,
            borderRadius: 99,
            paddingHorizontal: 8,
            paddingVertical: 3,
            overflow: "hidden",
          }}
        >
          {tag}
        </Text>
      )}
    </View>
  );
}

function CodeBox({ code, onShare }: { code: string; onShare: () => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: C.sand,
        borderRadius: 16,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: C.lineStrong,
        padding: 10,
      }}
    >
      <Text
        selectable
        style={{
          flex: 1,
          fontFamily: F.semi,
          fontSize: 24,
          letterSpacing: 5,
          fontVariant: ["tabular-nums"],
          color: C.teal,
          textAlign: "center",
        }}
      >
        {code}
      </Text>
      <Btn
        title="Share"
        kind="green"
        icon="share-social"
        height={42}
        style={{ width: 110 }}
        onPress={onShare}
      />
    </View>
  );
}
