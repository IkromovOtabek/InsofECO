import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { HeaderHeightContext } from '@react-navigation/elements';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, IconButton, IconTile, Skeleton, Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { copyText, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { Appear, haptic } from '@/design/motion';
import { elevation, radius, size, space } from '@/design/tokens';
import { BubbleShell, Composer, TypingDots } from '@/components/chat-ui';
import { erpAuth, type ErpAiAnswer, type ErpAiTurn } from '@/core/erp';

/**
 * AI yordamchi — vebdagi "Tahlil → AI" bilan bitta miya (`/api/mobile/ai`).
 *
 * Bo'sh holatda tayyor savollar (token sarflamaydi, darhol javob) guruhlab ko'rsatiladi;
 * erkin savol til modeliga ketadi va u kerakli raqamlarni bazadan o'zi oladi.
 * Suhbat faqat ekranda turadi — ilova yopilsa tozalanadi (maxfiy raqamlar telefonda qolmasin).
 *
 * Javob kutilayotganda — uch nuqtali "yozmoqda" pufakchasi; javob kartasida nusxalash tugmasi;
 * xato pufakchasida "Qayta urinish" (savol qayta yozilmaydi). Suhbat davomida tayyor savollar
 * yozish maydoni ustida chip bo'lib turadi.
 */
type Call = () => Promise<{ answer: ErpAiAnswer; level: 0 | 2 }>;
type Msg = { id: string; role: 'user' | 'assistant'; text: string; answer?: ErpAiAnswer; ai?: boolean; error?: boolean; retry?: { question: string; call: Call } };

let seq = 0;
const nextId = () => `m${++seq}`;

/** Javobning nusxalanadigan to'liq matni: asosiy matn + ro'yxat nuqtalari. */
const plain = (m: Msg) => [m.text, ...(m.answer?.bullets ?? []).map((b) => `• ${b}`)].filter(Boolean).join('\n');

export function ErpAiChat() {
  const { c } = useTheme();
  const nav = useNavigation();
  const headerH = React.useContext(HeaderHeightContext) ?? 0;
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

  /** `echo=false` — qayta urinish: savol pufakchasi allaqachon turibdi. */
  const run = async (question: string, call: Call, echo = true) => {
    if (echo) setMsgs((m) => [...m, { id: nextId(), role: 'user', text: question }]);
    setBusy(true);
    try {
      const r = await call();
      haptic.light();
      setMsgs((m) => [...m, { id: nextId(), role: 'assistant', text: r.answer.text, answer: r.answer, ai: r.level === 2 }]);
    } catch (e) {
      haptic.error();
      setMsgs((m) => [...m, { id: nextId(), role: 'assistant', text: (e as Error).message || "Javob kelmadi — internetni tekshiring", error: true, retry: { question, call } }]);
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
  const retry = (m: Msg) => {
    if (busy || !m.retry) return;
    const { question, call } = m.retry;
    setMsgs((all) => all.filter((x) => x.id !== m.id));
    void run(question, call, false);
  };

  const suggestions = (catalog.data?.groups ?? []).flatMap((g) => g.questions).slice(0, 10);
  const canSend = !!text.trim() && !busy;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bgSubtle }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerH}>
      <FlatList
        ref={list}
        data={msgs}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.pageX, gap: space.md, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={{ gap: space.xl }}>
            <Appear>
              <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                <IconTile icon="sparkles" module="brand" size={size.avatarLg} />
                <View style={{ flex: 1 }}>
                  <Txt v="titleSm">Zavod haqida istalgan savol</Txt>
                  <Txt v="caption" style={{ marginTop: space.xs }}>
                    Sotuv, qarz, kassa, sklad, reyslar — javob ERP bazasidagi jonli raqamlardan.
                  </Txt>
                </View>
              </Card>
            </Appear>
            {catalog.isLoading ? (
              <View style={{ gap: space.sm }}>
                <Skeleton width={96} height={space.md} />
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {[0, 1].map((i) => <Skeleton key={i} width="45%" height={size.touch - space.sm} radius={radius.pill} />)}
                </View>
              </View>
            ) : null}
            {catalog.isError ? (
              <Txt v="caption" color="muted" align="center">Tayyor savollar yuklanmadi — ERP serveriga ulanib bo&apos;lmadi. Savolni pastdan yozsangiz ham bo&apos;ladi.</Txt>
            ) : null}
            {catalog.data?.groups.map((g, gi) => (
              <Appear key={g.label} delay={80 + gi * 60} style={{ gap: space.sm }}>
                <Txt v="overline" color="muted">{g.label}</Txt>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -space.pageX }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.pageX, paddingVertical: space.xs }}>
                  {g.questions.map((q) => <SuggestionChip key={q.key} text={q.text} onPress={() => quick(q.key, q.text)} />)}
                </ScrollView>
              </Appear>
            ))}
            {catalog.data && !catalog.data.llm ? (
              <Txt v="caption" color="muted">Erkin savollar hozir tayyor hisob-kitoblar bo&apos;yicha javob oladi — AI kaliti ulanmagan.</Txt>
            ) : null}
          </View>
        }
        renderItem={({ item: m }) => <Bubble m={m} onRetry={m.retry ? () => retry(m) : undefined} busy={busy} />}
        ListFooterComponent={busy ? <View style={{ marginTop: space.xs }}><TypingDots label="AI javob yozmoqda" /></View> : null}
      />

      <Composer
        value={text}
        onChangeText={setText}
        onSend={ask}
        canSend={canSend}
        placeholder="Savol yozing… masalan, bu hafta kim ko'p oldi?"
        bottom={space.md + 2}
        inputProps={{ accessibilityLabel: 'Savol matni', autoCorrect: false, spellCheck: false, onSubmitEditing: ask, blurOnSubmit: true }}
        top={msgs.length && suggestions.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.md + 2, paddingTop: space.sm, paddingBottom: space.xs }}>
            {suggestions.map((q) => <SuggestionChip key={q.key} text={q.text} compact disabled={busy} onPress={() => quick(q.key, q.text)} />)}
          </ScrollView>
        ) : null}
      />
    </KeyboardAvoidingView>
  );
}

/** Tayyor savol chipi — oq pill, yumshoq soya. `compact` — yozish maydoni ustidagi qator. */
function SuggestionChip({ text, onPress, compact, disabled }: { text: string; onPress: () => void; compact?: boolean; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => { haptic.selection(); onPress(); }} disabled={disabled}
      accessibilityRole="button" accessibilityLabel={text} accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: compact ? size.touch - space.md : size.touch - space.sm, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: pressed ? c.brandSoft : c.bgSurface },
        elevation(c).sh1, disabled && { opacity: 0.5 },
      ]}
    >
      <Icon name="sparkles" size={size.iconSm - 2} tone="brand" />
      <Txt v="label" color="body" numberOfLines={1}>{text}</Txt>
    </Pressable>
  );
}

/**
 * Bitta xabar: meniki o'ngda brend pufakchada; javob chapda oq kartada (ro'yxat nuqtalari, manba,
 * nusxalash); xato — qizil yumshoq kartada "Qayta urinish" bilan.
 */
function Bubble({ m, onRetry, busy }: { m: Msg; onRetry?: () => void; busy: boolean }) {
  const { c } = useTheme();
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(t); }, [copied]);
  const mine = m.role === 'user';

  if (mine) {
    return (
      <Appear from={8}>
        <BubbleShell side="out" maxWidth="82%" label={`Siz: ${m.text}`}>
          <Txt v="body" color="onBrand">{m.text}</Txt>
        </BubbleShell>
      </Appear>
    );
  }

  if (m.error) {
    return (
      <Appear from={8} style={{ alignItems: 'flex-start' }}>
        <View accessibilityRole="alert" style={{ maxWidth: '94%', gap: space.sm, backgroundColor: c.dangerBg, padding: space.md + space.xs, borderRadius: radius.card, borderBottomLeftRadius: radius.xs, borderCurve: 'continuous' }}>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <Icon name="circle-alert" tone="danger" size={size.iconMd} />
            <Txt v="bodySm" color="danger" style={{ flex: 1 }}>{m.text}</Txt>
          </View>
          {onRetry ? <Button title="Qayta urinish" icon="refresh-cw" variant="secondary" full={false} disabled={busy} onPress={onRetry} /> : null}
        </View>
      </Appear>
    );
  }

  const copy = async () => {
    const ok = await copyText(plain(m));
    if (ok) { haptic.success(); setCopied(true); } else toast.error("Nusxa olinmadi — matnni qo'lda belgilang");
  };

  return (
    <Appear from={8}>
      <BubbleShell side="in" maxWidth="94%" label={`AI: ${m.text}`} style={{ gap: space.xs, paddingHorizontal: space.card }}>
        <Markdown text={m.text} />
        {m.answer?.bullets?.map((b, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
            <Icon name="dot" tone="brand" />
            <Txt v="bodySm" color="body" style={{ flex: 1 }}>{b}</Txt>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs, borderTopWidth: size.hairline, borderTopColor: c.borderSubtle, paddingTop: space.xs }}>
          <Icon name={m.ai ? 'sparkles' : 'calculator'} size={size.iconSm - 2} tone="faint" />
          <Txt v="caption" color="muted" style={{ flex: 1 }}>{m.ai ? 'AI javobi' : 'Hisob-kitob · joriy oy'}</Txt>
          <IconButton
            icon={copied ? 'check' : 'copy'} tone={copied ? 'success' : 'muted'} size={size.touch - space.sm}
            label={copied ? 'Nusxa olindi' : 'Javobni nusxalash'}
            onPress={() => void copy()}
          />
        </View>
      </BubbleShell>
    </Appear>
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
