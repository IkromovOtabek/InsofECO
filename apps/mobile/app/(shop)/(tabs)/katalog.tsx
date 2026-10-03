import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, EmptyState, Skeleton, Txt } from '@/design/primitives';
import { ChipGroup, Reveal, SegmentedControl, Toggle } from '@/design/blocks';
import { Sheet } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useShopCatalog } from '@/features/shop/api';
import { useCart } from '@/features/shop/cart';
import { MiniChip, ProductGrid, ShopTopBar } from '@/features/shop/ui';

const ALL = '__all';
type Sort = 'default' | 'cheap' | 'expensive';
const NEXT_SORT: Record<Sort, Sort> = { default: 'cheap', cheap: 'expensive', expensive: 'default' };
const SORT_CHIP: Record<Sort, string> = { default: 'Arzonroq', cheap: 'Arzonroq', expensive: 'Qimmatroq' };

function CatalogSkeleton() {
  return (
    <View style={{ gap: space.md }}>
      <Skeleton height={size.chip + size.chipPad * 2} radius={radius.pill} />
      <Skeleton height={size.touch - space.sm} width="60%" radius={radius.pill} />
      {[0, 1].map((r) => (
        <View key={r} style={{ flexDirection: 'row', gap: space.md }}>
          <Skeleton height={size.driverTouch * 3.6} radius={radius.card} style={{ flex: 1 }} />
          <Skeleton height={size.driverTouch * 3.6} radius={radius.card} style={{ flex: 1 }} />
        </View>
      ))}
    </View>
  );
}

/**
 * Katalog — demo CLIENT[1]: qidiruv, toifa chiplari (ERP guruhlari), "N mahsulot" + "Arzonroq" / "Filtr",
 * ikki ustunli `pcard` setka ("+" — savatga). Bosh sahifadagi toifa `?group=`, qidiruv `?focus=`,
 * profildagi "Saralanganlar" `?fav=1` bilan ochadi. Filtr — faqat haqiqiy maydonlar: o'lchov birligi va saralanganlar.
 */
export default function ShopCatalogScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ group?: string; focus?: string; t?: string; fav?: string }>();
  const q = useShopCatalog();
  const favs = useCart((s) => s.favs);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<string>(params.group ?? ALL);
  const [sort, setSort] = useState<Sort>('default');
  const [unit, setUnit] = useState<string>(ALL);
  const [onlyFav, setOnlyFav] = useState(params.fav === '1');
  const [filterOpen, setFilterOpen] = useState(false);

  // Tab allaqachon ochiq bo'lsa ham bosh sahifadan kelgan toifa qo'llanadi (`t` — har bosishda yangi)
  useEffect(() => { if (params.group) setGroup(params.group); }, [params.group, params.t]);
  useEffect(() => { if (params.fav === '1') setOnlyFav(true); }, [params.fav, params.t]);

  const all = useMemo(() => q.data?.items ?? [], [q.data]);
  const groups = useMemo(() => Array.from(new Set(all.map((i) => i.group).filter((g): g is string => !!g))), [all]);
  const units = useMemo(() => Array.from(new Set(all.map((i) => i.unitLabel))), [all]);
  const items = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = all.filter((i) =>
      (group === ALL || i.group === group)
      && (unit === ALL || i.unitLabel === unit)
      && (!onlyFav || favs.includes(i.id))
      && (!s || [i.name, i.code, i.strengthClass, i.group].filter(Boolean).join(' ').toLowerCase().includes(s)));
    if (sort === 'cheap') return [...list].sort((a, b) => a.price - b.price);
    if (sort === 'expensive') return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [all, search, group, sort, unit, onlyFav, favs]);

  const filterCount = (unit !== ALL ? 1 : 0) + (onlyFav ? 1 : 0);
  const canFilter = units.length > 1 || favs.length > 0 || onlyFav;
  const filtered = !!search.trim() || group !== ALL || filterCount > 0;
  const reset = () => { setSearch(''); setGroup(ALL); setUnit(ALL); setOnlyFav(false); };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ShopTopBar key={params.focus ?? 'k'} search={search} onSearch={setSearch} autoFocus={!!params.focus} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        {q.error && !q.data ? (
          <EmptyState icon="circle-alert" title="Ro'yxat yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
        ) : (
          <Reveal loading={q.isLoading} skeleton={<CatalogSkeleton />} gap={space.md + 2}>
            {groups.length > 1 ? (
              <ChipGroup items={[{ key: ALL, label: 'Hammasi' }, ...groups.map((g) => ({ key: g, label: g }))]} value={groups.includes(group) ? group : ALL} onChange={setGroup} />
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
              <Txt v="tSm" numberOfLines={1} style={{ flexShrink: 1 }}><Txt v="tSm" color="strong">{items.length}</Txt> mahsulot</Txt>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <MiniChip label={SORT_CHIP[sort]} icon="list" active={sort !== 'default'} hint="Bosilsa saralash almashadi" onPress={() => setSort(NEXT_SORT[sort])} />
                {canFilter ? <MiniChip label={filterCount ? `Filtr · ${filterCount}` : 'Filtr'} icon="settings" active={filterCount > 0} onPress={() => setFilterOpen(true)} /> : null}
              </View>
            </View>
            {items.length ? (
              <ProductGrid items={items} onOpen={(id) => router.push(`/(shop)/${id}` as never)} />
            ) : (
              <EmptyState
                icon={filtered ? 'search' : 'store'}
                title={filtered ? 'Topilmadi' : "Katalog hozircha bo'sh"}
                hint={filtered ? "Boshqa so'z yoki toifani tanlang" : "Mahsulotlar tez orada qo'shiladi"}
                action={filtered ? 'Filtrni tozalash' : undefined}
                onAction={filtered ? reset : undefined}
              />
            )}
          </Reveal>
        )}
      </ScrollView>

      <Sheet
        open={filterOpen} onClose={() => setFilterOpen(false)} title="Filtr"
        footer={<Button title={`${items.length} ta mahsulotni ko'rsatish`} size="lg" onPress={() => setFilterOpen(false)} />}
      >
        <View style={{ gap: space.lg }}>
          {units.length > 1 ? (
            <View style={{ gap: space.sm }}>
              <Txt v="overline">O&apos;lchov birligi</Txt>
              <SegmentedControl items={[{ key: ALL, label: 'Hammasi' }, ...units.map((u) => ({ key: u, label: u }))]} value={unit} onChange={setUnit} />
            </View>
          ) : null}
          {favs.length || onlyFav ? <Toggle value={onlyFav} onChange={setOnlyFav} label="Faqat saralanganlar" hint={`${favs.length} ta mahsulot yulduzcha bilan belgilangan`} /> : null}
          {filterCount ? <Button title="Tozalash" variant="ghost" icon="x" onPress={() => { setUnit(ALL); setOnlyFav(false); }} /> : null}
        </View>
      </Sheet>
    </View>
  );
}
