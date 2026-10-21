import { router } from 'expo-router';

/**
 * Return to the Home tab without stacking a second copy of the tabs:
 * pop everything above the tab navigator, then switch tabs.
 */
export function goHome() {
  if (router.canDismiss()) router.dismissAll();
  router.navigate('/');
}
