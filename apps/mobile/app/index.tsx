import { ActivityIndicator, View } from 'react-native';
// Gate (_layout) yo'naltiradi; bu ekran faqat sessiya yuklanguncha ko'rinadi.
export default function Index() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
}
