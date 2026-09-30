import { View } from 'react-native';
import { useTheme } from '@/design/theme';
import { Loader } from '@/design/loader';
// Gate (_layout) yo'naltiradi; bu ekran faqat sessiya yuklanguncha ko'rinadi.
export default function Index() {
  const { c } = useTheme();
  return <Loader fill label={null} style={{ backgroundColor: c.bgApp }} />;
}
