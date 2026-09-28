// "Sign in to save your forest and continue learning"
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Btn, Enter, Progress, Screen, T } from '@/components/ui';
import { tap } from '@/lib/feedback';
import { useApp } from '@/store';
import { C, F } from '@/theme';

export default function SignIn() {
  const setProfile = useApp((s) => s.setProfile);
  const profile = useApp((s) => s.profile);
  const [form, setForm] = useState(false);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);

  const done = () => {
    setProfile({ name: name.trim() || 'Student', email: email.trim(), signedIn: true });
    router.push('/onboarding/reminder');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll>
        <View style={{ paddingHorizontal: 10, marginBottom: 28 }}>
          <Progress value={1} />
        </View>
        <Enter>
          <T v="h1" style={{ fontSize: 38, marginBottom: 32 }}>
            Sign in to save your forest and continue learning
          </T>
        </Enter>
        {!form ? (
          <Enter delay={100} style={{ gap: 12 }}>
            <Btn title="Continue with Google" kind="white" iconLeft="logo-google" height={50} onPress={() => setForm(true)} />
            <Btn title="Continue with Email" kind="teal" iconLeft="mail" height={50} onPress={() => setForm(true)} />
            <Btn title="Not now" kind="dark" height={50} onPress={() => router.push('/onboarding/reminder')} />
          </Enter>
        ) : (
          <Enter style={{ gap: 12 }}>
            <Field icon="person-outline" value={name} onChange={setName} placeholder="Your name" />
            <Field icon="mail-outline" value={email} onChange={setEmail} placeholder="Email" keyboard="email-address" />
            <Btn title="Save my forest" kind="teal" icon="arrow-forward" disabled={!name.trim()} onPress={done} />
            <Pressable onPress={() => (tap(), setForm(false))} style={{ alignSelf: 'center', padding: 6 }}>
              <Text style={{ fontFamily: F.medium, color: C.muted }}>Back</Text>
            </Pressable>
          </Enter>
        )}
        <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 28 }}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, value, onChange, placeholder, keyboard }: { icon: keyof typeof Ionicons.glyphMap; value: string; onChange: (s: string) => void; placeholder: string; keyboard?: 'email-address' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.teal, borderRadius: 14, paddingHorizontal: 14 }}>
      <Ionicons name={icon} size={18} color={C.teal} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#A69A8A"
        keyboardType={keyboard}
        autoCapitalize={keyboard ? 'none' : 'words'}
        style={{ flex: 1, paddingVertical: 14, fontFamily: F.medium, fontSize: 15, color: C.ink }}
      />
    </View>
  );
}
