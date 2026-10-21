import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { View, type ColorValue } from 'react-native';
import { ActiveWorkoutBar } from '@/components/ActiveWorkoutBar';
import { C } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const icon = (on: IconName, off: IconName) =>
  function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Ionicons name={focused ? on : off} size={23} color={(color as string) ?? undefined} />;
  };

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.border },
          tabBarActiveTintColor: C.accentText,
          tabBarInactiveTintColor: C.textFaint,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          sceneStyle: { backgroundColor: C.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
        <Tabs.Screen name="programs" options={{ title: 'Programs', tabBarIcon: icon('albums', 'albums-outline') }} />
        <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('calendar', 'calendar-outline') }} />
        <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarIcon: icon('stats-chart', 'stats-chart-outline') }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
      </Tabs>
      <ActiveWorkoutBar />
    </View>
  );
}
