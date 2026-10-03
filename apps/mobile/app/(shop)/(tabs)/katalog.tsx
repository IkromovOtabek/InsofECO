import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, Skeleton, Txt } from '@/design/primitives';
import { ChipGroup } from '@/design/blocks';
import { Icon } from '@/design/icons';
import { haptic } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space } from '@/design/tokens';
import { useShopCatalog } from '@/features/shop/api';
import { ProductCard, ShopTopBar } from '@/features/shop/ui';

const ALL = '__all';
type Sort = 'default' | 'cheap' | 'expensive';
const SORT_LABEL: Record<Sort, string> = { default: 'Tavsiya', cheap: 'Arzonroq', expensive: 'Qimmatroq' };
const NEXT_SORT: Record<Sort, Sort> = { default: 'cheap', cheap: 'expensive', expensive: 'default' };

/**
 * Katalog (chizma "Katalog"): qidiruv, toifa chiplari (ERP mahsulot guruhlari), soni + saralash,
 * ikki ustunli kartalar. Bosh sahifadagi toifa plitkasi `?group=` bilan, qidiruv `?focus=` bilan ochadi.
 */
export default function ShopCatalogScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ group?: string; focus?: string }>();
  const q = useShopCatalog();
  const { width } = useWindowDimensions();
  const colW = (width - space.pageX * 2 - space.md) / 2;
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<string>(params.group ?? ALL);
  const [sort, setSort] = useState<Sort>('default');
  const input = useRef<TextInput>(null);

  // Tab allaqachon ochiq bo'lsa ham bosh sahifadan kelgan toifa/qidiruv qo'llanadi
  useEffect(() => { if (params.group) setGroup(params.group); }, [params.group]);
  useEffect(() => { if (params.focus) { const t = setTimeout(() => input.current?.focus(), 250); return () => clearTimeout(t); } }, [params.focus]);

  const groups = useMemo(() => Array.from(new Set((q.data?.items ?? []).map((i) => i.group).filter((g): g is string => !!g))), [q.data]);
  const items = useMemo(() => {
    const all = q.data?.items ?? [];
    const s = search.trim().toLowerCase();
    const list = all.filter((i) => (group === ALL || i.group === group) && (!s || [i.name, i.code, i.strengthClass, i.group].filter(Boolean).join(' ').toLowerCase().includes(s)));
    if (sort === 'cheap') return [...list].sort((a, b) => a.price - b.price);
    if (sort === 'expensive') return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [q.data, search, group, sort]);

  const filtered = !!search.trim() || group !== ALL;

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.xs }}>
      {groups.length > 1 ? (
        <ChipGroup items={[{ key: ALL, label: 'Hammasi' }, ...groups.map((g) => ({ key: g, label: g }))]} value={groups.includes(group) ? group : ALL} onChange={setGroup} />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="bodySm" color="muted"><Txt v="bodyStrong">{items.length}</Txt> mahsulot</Txt>
        <Pressable
          accessibilityRole="button" accessibilityLabel={`Saralash: ${SORT_LABEL[sort]}`} accessibilityHint="Bosilsa saralash almashadi"
          onPress={() => { haptic.selection(); setSort(NEXT_SORT[sort]); }}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: size.touch - space.sm, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: sort === 'default' ? c.bgSurface : c.brandSoft, opacity: pressed ? 0.7 : 1 }, shadow.card]}
        >
          <Icon name="arrow-up-down" size={size.iconSm - 2} tone={sort === 'default' ? 'body' : 'brand'} />
          <Txt v="label" color={sort === 'default' ? 'body' : 'brand'}>{SORT_LABEL[sort]}</Txt>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ShopTopBar search={search} onSearch={setSearch} inputRef={input} />

      {q.isLoading ? (
        <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm, gap: space.md }}>
          <Skeleton height={size.touch} radius={radius.pill} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} width="47%" height={size.driverTouch * 3} radius={radius.card} />)}
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: space.md }}
          contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxl, gap: space.md }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={header}
          refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
          renderItem={({ item }) => (
            <View style={{ flex: 1, maxWidth: colW }}>
              <ProductCard item={item} onPress={() => router.push(`/(shop)/${item.id}` as never)} />
            </View>
          )}
          ListEmptyComponent={
            q.error
              ? <EmptyState icon="circle-alert" title="Ro'yxat yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
              : <EmptyState
                  icon={filtered ? 'search' : 'store'}
                  title={filtered ? 'Topilmadi' : "Katalog hozircha bo'sh"}
                  hint={filtered ? "Boshqa so'z yoki toifani tanlang" : "Mahsulotlar tez orada qo'shiladi"}
                  action={filtered ? 'Filtrni tozalash' : undefined}
                  onAction={filtered ? () => { setSearch(''); setGroup(ALL); } : undefined}
                />
          }
        />
      )}
    </View>
  );
}
