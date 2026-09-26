import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/design/theme';
// Gate (_layout) yo'naltiradi; bu ekran faqat sessiya yuklanguncha ko'rinadi.
export default function Index() {
  const { c } = useTheme();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgApp }}><ActivityIndicator color={c.brand} /></View>;
}
