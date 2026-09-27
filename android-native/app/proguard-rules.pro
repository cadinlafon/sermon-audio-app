# Add project specific ProGuard rules here.
# https://developer.android.com/studio/build/shrink-code

# Retrofit / OkHttp response models — keep field names so Gson can map
# JSON from the Supabase edge function without reflection breaking.
-keep class com.palousefellowship.audio.data.remote.** { *; }
-keepattributes Signature
-keepattributes *Annotation*

# Firebase Firestore POJOs are mapped by reflection — keep the data
# classes and their no-arg constructors / property names intact.
-keep class com.palousefellowship.audio.data.model.** { *; }
-keepclassmembers class com.palousefellowship.audio.data.model.** {
    <init>(...);
}
