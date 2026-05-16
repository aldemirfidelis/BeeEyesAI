# Unity export placeholder

Export the Casa da Bee Unity project as an Android Gradle project and place the generated `unityLibrary` module here:

```text
mobile/android/unity-export/unityLibrary
```

The Gradle files are already conditional:

- `mobile/android/settings.gradle` includes `:unityLibrary` only when this folder exists.
- `mobile/android/app/build.gradle` adds `implementation project(":unityLibrary")` only when the module is present.

This keeps normal Android builds working before the Unity export exists, while allowing the same React Native bridge to open Unity once exported.
