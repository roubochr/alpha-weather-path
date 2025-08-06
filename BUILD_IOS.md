# iOS Build Instructions for WeatherPath

## Prerequisites
- macOS with Xcode installed
- Node.js and npm
- CocoaPods (`sudo gem install cocoapods`)

## Build Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the web app:**
   ```bash
   npm run build
   ```

3. **Sync with iOS:**
   ```bash
   npx cap sync ios
   ```

4. **Install iOS dependencies:**
   ```bash
   cd ios/App && pod install && cd ../..
   ```

5. **Open in Xcode:**
   ```bash
   npx cap open ios
   ```

6. **In Xcode:**
   - Select your development team in the project settings
   - Choose a connected iOS device or simulator
   - Click the Run button to build and install

## App Store Deployment

1. **Update version in Info.plist**
2. **Archive the app in Xcode (Product → Archive)**
3. **Upload to App Store Connect**
4. **Submit for review**

## Notes
- The app bundle ID is: `com.weatherpath.app`
- Minimum iOS version: 13.0
- Supports iPhone and iPad
- Location permissions are requested for weather functionality

## Troubleshooting
- If build fails, try: `npx cap clean ios && npx cap sync ios`
- For dependency issues: `cd ios/App && pod install --repo-update`