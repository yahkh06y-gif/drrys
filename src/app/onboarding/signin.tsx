// Accounts: sign up / sign in with email + password (Supabase). The forest is backed up to the cloud and
// comes back on a new phone. Onboarding asks for nothing (value before asking): it opens here only from
// "I already have an account". After the first session it comes as "Save your tree" (?save=1, with "Later").
// From Profile it opens as "Your account" (edit name, sign out) or as the sign-in form.
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Btn, Confirm, Enter, IconBtn, OnbBar, Screen, T } from '@/components/ui';
import { useBack } from '@/lib/back';
import { cloudEnabled, signIn, signOut, signUp } from '@/lib/cloud';
import { haptic, play, tap } from '@/lib/feedback';
import { refreshTogether } from '@/lib/together';
import { useApp } from '@/store';
import { C, F } from '@/theme';

type Mode = 'signup' | 'signin';

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string; save?: string }>();
  const saving = params.save === '1'; // after the first session: "Save your tree"
  const setProfile = useApp((s) => s.setProfile);
  const set = useApp((s) => s.set);
  const profile = useApp((s) => s.profile);
  // opened from Profile after onboarding
  // fixed when the screen opens (signing in during onboarding flips `onboarded` mid-way)
  const [editing] = useState(() => useApp.getState().onboarded);
  const account = editing && !!profile.uid; // signed in → "Your account"
  const [mode, setMode] = useState<Mode>(params.mode === 'signin' ? 'signin' : 'signup');
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [askOut, setAskOut] = useState(false);

  // once the first tree is planted, going back would plant it again: the way back stops here
  const planted = useApp((s) => !s.onboarded && s.subjects.length > 0);
  const onBack = useCallback(() => planted, [planted]);
  useBack(onBack);

  const next = (restoredOnboarded: boolean) => {
    if (saving) return router.dismissTo('/(tabs)/tree');
    if (editing) return router.back();
    if (restoredOnboarded) {
      // an existing account on a new phone: their forest is back, skip the rest of onboarding
      set({ onboarded: true });
      play('celebrate');
      return router.replace('/(tabs)/tree');
    }
    goOn();
  };

  // "Later" after the first session → back to the forest; during onboarding → on to Coco's hello
  const goOn = () => {
    if (saving) router.dismissTo('/(tabs)/tree');
    else router.push('/onboarding/hello');
  };

  const submit = async () => {
    setError('');
    setBusy(true);
    const r = mode === 'signup' ? await signUp(email, password, name) : await signIn(email, password);
    setBusy(false);
    if (!r.ok) {
      haptic('error');
      return setError(r.error);
    }
    haptic('success');
    refreshTogether(); // this account's squad and invite rewards (free branch, squad discount)
    // an account that already finished onboarding (on this or another phone) skips the rest of it,
    // including "how did you hear about us"
    next(r.known || (r.restored && useApp.getState().onboarded));
  };

  const valid = /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 6 && (mode !== 'signup' || !!name.trim());
  const title = account ? 'Your account' : mode === 'signin' ? 'Welcome back' : saving ? 'Save your tree. Create an account' : 'Create your account to save your forest';

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ gestureEnabled: !planted }} />
      <Screen scroll>
        {editing ? (
          <View style={{ marginBottom: 20 }}>
            <IconBtn name="arrow-back" onPress={() => (saving ? goOn() : router.back())} />
          </View>
        ) : (
          <OnbBar value={0} onBack={planted ? false : undefined} style={{ marginBottom: 28 }} />
        )}
        <Enter key={account ? 'acct' : mode}>
          <T v="h1" style={{ fontSize: 34, lineHeight: 40, marginBottom: 10 }}>
            {title}
          </T>
          {!account && (
            <T v="small" style={{ color: C.body, marginBottom: 22 }}>
              {mode === 'signin' ? 'Sign in and your trees come right back.' : 'Your trees, cards and streak are backed up, so they’re safe on any phone.'}
            </T>
          )}
        </Enter>

        {account ? (
          <Enter style={{ gap: 12 }}>
            <Field icon="person-outline" value={name} onChange={setName} placeholder="Your name" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.sand, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 }}>
              <Ionicons name="mail-outline" size={18} color={C.muted} />
              <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 15, color: C.body }}>{profile.email}</Text>
              <Ionicons name="cloud-done-outline" size={18} color={C.leaf} />
            </View>
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.leaf }}>Your forest is backed up to this account.</Text>
            <Btn title="Save" kind="teal" disabled={!name.trim()} onPress={() => (setProfile({ name: name.trim() }), router.back())} />
            <Btn title="Sign out" kind="light" height={46} onPress={() => setAskOut(true)} />
          </Enter>
        ) : !cloudEnabled ? (
          <Enter style={{ gap: 12 }}>
            <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.body }}>Accounts aren’t switched on in this build yet — your forest is saved on this phone.</Text>
            <Btn title={editing && !saving ? 'Back' : 'Continue'} kind="teal" onPress={() => (editing && !saving ? router.back() : goOn())} />
          </Enter>
        ) : (
          <Enter style={{ gap: 12 }}>
            {mode === 'signup' && <Field icon="person-outline" value={name} onChange={setName} placeholder="Your name" />}
            <Field icon="mail-outline" value={email} onChange={setEmail} placeholder="Email" keyboard="email-address" />
            <Field icon="lock-closed-outline" value={password} onChange={setPassword} placeholder={mode === 'signup' ? 'Password (6+ characters)' : 'Password'} secret onSubmit={valid ? submit : undefined} />
            {!!error && <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.red }}>{error}</Text>}
            <Btn
              title={mode === 'signup' ? 'Create account' : 'Sign in'}
              kind="teal"
              icon="arrow-forward"
              loading={busy}
              disabled={!valid}
              onPress={submit}
            />
            <Pressable onPress={() => (tap(), setError(''), setMode(mode === 'signup' ? 'signin' : 'signup'))} style={{ alignSelf: 'center', padding: 6 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.teal }}>
                {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
              </Text>
            </Pressable>
            {(!editing || saving) && (
              <Btn title={saving ? 'Later' : 'Not now'} kind="light" height={46} onPress={() => (setProfile({ name: name.trim() || profile.name }), goOn())} />
            )}
          </Enter>
        )}
      </Screen>
      <Confirm
        visible={askOut}
        title="Sign out?"
        body="Your forest stays on this phone, but it stops backing up until you sign in again."
        yes="Sign out"
        no="Stay signed in"
        onNo={() => setAskOut(false)}
        onYes={async () => {
          setAskOut(false);
          await signOut();
          router.back();
        }}
      />
    </View>
  );
}

function Field({
  icon,
  value,
  onChange,
  placeholder,
  keyboard,
  secret,
  onSubmit,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
  keyboard?: 'email-address';
  secret?: boolean;
  onSubmit?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.teal, borderRadius: 14, paddingHorizontal: 14 }}>
      <Ionicons name={icon} size={18} color={C.teal} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#A69A8A"
        keyboardType={keyboard}
        autoCapitalize={keyboard || secret ? 'none' : 'words'}
        autoCorrect={false}
        autoComplete={secret ? 'password' : keyboard ? 'email' : 'name'}
        secureTextEntry={secret && !show}
        returnKeyType={onSubmit ? 'go' : 'next'}
        onSubmitEditing={onSubmit}
        style={{ flex: 1, paddingVertical: 14, fontFamily: F.medium, fontSize: 15, color: C.ink }}
      />
      {secret && (
        <Pressable hitSlop={8} onPress={() => setShow(!show)} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
        </Pressable>
      )}
    </View>
  );
}
