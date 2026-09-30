// The splash picture: Coco's clay face on the full screen, shown only while the app loads.
// The native splash (same colour, same face) hands over to it as soon as it's on screen.
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, View } from 'react-native';

export const LAUNCH_BG = '#EAD9CF';

const hide = () => SplashScreen.hideAsync().catch(() => {});

export function Launch() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: LAUNCH_BG }]}>
      <Image source={require('../../assets/images/launch.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" onDisplay={hide} onError={hide} />
    </View>
  );
}
