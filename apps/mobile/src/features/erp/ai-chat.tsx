import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, IconButton, IconTile, Input, Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { erpAuth, type ErpAiAnswer, type ErpAiTurn } from '@/core/erp';

/**
 * AI yordamchi — vebdagi "Tahlil → AI" bilan bitta miya (`/api/mobile/ai`).
 *
 * Bo'sh holatda tayyor savollar (token sarflamaydi, darhol javob) guruhlab ko'rsatiladi;
 * erkin savol til modeliga ketadi va u kerakli raqamlarni bazadan o'zi oladi.
 * Suhbat faqat ekranda turadi — ilova yopilsa tozalanadi (maxfiy raqamlar telefonda qolmasin).
 */
type Msg = { id: string; role: 'user' | 'assistant'; text: string; answer?: ErpAiAnswer; ai?: boolean; error?: boolean };

let seq = 0;
const nextId = () => `m${++seq}`;

export function ErpAiChat() {
  const { c } = useTheme();
  const nav = useNavigation();
  const catalog = useQuery({ queryKey: ['erp', 'ai-catalog'], queryFn: erpAuth.aiCatalog, staleTime: 10 * 60_000 });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<FlatList>(null);

  // Sarlavhada "Yangi suhbat" — faqat suhbat bor paytda
  useEffect(() => {
    nav.setOptions({
      headerRight: msgs.length
        ? () => <IconButton icon="refresh-cw" label="Yangi suhbat" tone="muted" onPress={() => setMsgs([])} style={{ marginRight: space.sm }} />
        : undefined,
    });
  }, [nav, msgs.length]);

  useEffect(() => {
    if (msgs.length) setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
  }, [msgs.length, busy]);

  const run = async (question: string, call: () => Promise<{ answer: ErpAiAnswer; level: 0 | 2 }>) => {
    setMsgs((m) => [...m, { id: nextId(), role: 'user', text: question }]);
    setBusy(true);
    try {
      const r = await call();
      setMsgs((m) => [...m, { id: nextId(), role: 'assistant', text: r.answer.text, answer: r.answer, ai: r.level === 2 }]);
    } catch (e) {
      setMsgs((m) => [...m, { id: nextId(), role: 'assistant', text: (e as Error).message || "Javob kelmadi — internetni tekshiring", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const ask = () => {
    const q = text.trim();
    if (!q || busy) return;
    setText('');
    // Oxirgi 6 ta almashuv — model avvalgi savolni eslab, "o'tgan oy-chi?" kabi davomni tushunadi
    const history: ErpAiTurn[] = msgs.filter((m) => !m.error).slice(-6).map((m) => ({ role: m.role, text: m.text }));
    void run(q, () => erpAuth.aiAsk(q, history));
  };
  const quick = (key: string, q: string) => { if (!busy) void run(q, () => erpAuth.aiQuick(key)); };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={list}
        data={msgs}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.pageX, gap: space.md, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={{ gap: space.lg }}>
            <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <IconTile icon="sparkles" module="brand" />
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">Zavod haqida istalgan savol</Txt>
                <Txt v="caption" style={{ marginTop: space.xs }}>
                  Sotuv, qarz, kassa, sklad, reyslar — javob ERP bazasidagi jonli raqamlardan.
                </Txt>
              </View>
            </Card>
            {catalog.isLoading ? <ActivityIndicator color={c.brand} /> : null}
            {catalog.isError ? (
              <Txt v="caption" color="muted" align="center">Tayyor savollar yuklanmadi — ERP serveriga ulanib bo&apos;lmadi. Savolni pastdan yozsangiz ham bo&apos;ladi.</Txt>
            ) : null}
            {catalog.data?.groups.map((g) => (
              <View key={g.label} style={{ gap: space.sm }}>
                <Txt v="overline" color="muted">{g.label}</Txt>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.sm, paddingRight: space.xs }}>
                  {g.questions.map((q) => (
                    <Pressable
                      key={q.key} onPress={() => quick(q.key, q.text)} accessibilityRole="button" accessibilityLabel={q.text}
                      style={({ pressed }) => ({ minHeight: size.touch - space.sm, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.bgSurface, borderWidth: size.hairline, borderColor: pressed ? c.brand : c.borderDefault })}
                    >
                      <Txt v="label" color="body" numberOfLines={1}>{q.text}</Txt>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ))}
            {catalog.data && !catalog.data.llm ? (
              <Txt v="caption" color="muted">Erkin savollar hozir tayyor hisob-kitoblar bo&apos;yicha javob oladi — AI kaliti ulanmagan.</Txt>
            ) : null}
          </View>
        }
        renderItem={({ item: m }) => <Bubble m={m} />}
        ListFooterComponent={busy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm }}>
            <ActivityIndicator color={c.brand} />
            <Txt v="caption" color="muted">Hisoblayapman…</Txt>
          </View>
        ) : null}
      />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: c.bgChrome, borderTopWidth: size.hairline, borderTopColor: c.borderDefault }}>
        <Input
          value={text} onChangeText={setText} placeholder="Savol yozing… masalan, bu hafta kim ko'p oldi?"
          accessibilityLabel="Savol matni" autoCorrect={false} spellCheck={false} multiline style={{ maxHeight: 120 }} containerStyle={{ marginBottom: 0, flex: 1 }}
          onSubmitEditing={ask} blurOnSubmit
        />
        <IconButton icon="send" label="Yuborish" variant="secondary" tone={text.trim() ? 'brand' : 'muted'} disabled={!text.trim() || busy} onPress={ask} />
      </View>
    </KeyboardAvoidingView>
  );
}

/** Bitta xabar: meniki o'ngda brend fonida, javob chapda oq kartada (ro'yxat nuqtalari bilan). */
function Bubble({ m }: { m: Msg }) {
  const { c } = useTheme();
  const mine = m.role === 'user';
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <View
        accessibilityLabel={`${mine ? 'Siz' : 'AI'}: ${m.text}`}
        style={{
          maxWidth: mine ? '82%' : '94%', gap: space.xs,
          backgroundColor: mine ? c.brandSoft : c.bgSurface, borderWidth: size.hairline,
          borderColor: m.error ? c.dangerSolid : mine ? c.brandSoft : c.borderDefault,
          paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.xl,
          borderBottomRightRadius: mine ? radius.xs : radius.xl, borderBottomLeftRadius: mine ? radius.xl : radius.xs,
        }}
      >
        {mine || m.error ? <Txt v="body" color="strong">{m.text}</Txt> : <Markdown text={m.text} />}
        {m.answer?.bullets?.map((b, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
            <Icon name="dot" tone="brand" />
            <Txt v="bodySm" color="body" style={{ flex: 1 }}>{b}</Txt>
          </View>
        ))}
        {!mine && !m.error ? (
          <Txt v="caption" color="muted" style={{ marginTop: space.xs }}>{m.ai ? 'AI javobi' : 'Hisob-kitob · joriy oy'}</Txt>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Til modeli javobidagi oddiy markdown: `**qalin**`, `- ro'yxat`, `# sarlavha`.
 * To'liq markdown kutubxonasi shart emas — model faqat shularni ishlatadi, qolgani oddiy matn.
 */
function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trimEnd());
  return (
    <View style={{ gap: space.xs }}>
      {lines.map((raw, i) => {
        if (!raw.trim()) return null;
        const bullet = /^\s*([-*•]|\d+[.)])\s+/.exec(raw);
        const heading = /^\s*#{1,6}\s+/.test(raw);
        const body = raw.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*([-*•]|\d+[.)])\s+/, '');
        const inline = <Inline text={body} v={heading ? 'bodyStrong' : bullet ? 'bodySm' : 'body'} />;
        if (!bullet) return <View key={i}>{inline}</View>;
        const mark = bullet[1] ?? '-';
        return (
          <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
            {/^\d/.test(mark) ? <Txt v="bodySm" color="brand">{mark}</Txt> : <Icon name="dot" tone="brand" />}
            <View style={{ flex: 1 }}>{inline}</View>
          </View>
        );
      })}
    </View>
  );
}

/** Qator ichidagi `**qalin**` bo'laklari. */
function Inline({ text, v }: { text: string; v: 'body' | 'bodySm' | 'bodyStrong' }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Txt v={v} color="strong">
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <Txt key={i} v="bodyStrong" color="strong">{p.slice(2, -2)}</Txt> : p))}
    </Txt>
  );
}
