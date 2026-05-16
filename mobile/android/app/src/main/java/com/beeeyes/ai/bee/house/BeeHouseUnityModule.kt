package com.beeeyes.ai.bee.house

import android.content.Intent
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BeeHouseUnityModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun getName(): String = NAME

  @ReactMethod
  fun isAvailable(promise: Promise) {
    promise.resolve(isUnityRuntimeAvailable())
  }

  @ReactMethod
  fun openHouse(payload: String, promise: Promise) {
    if (!isUnityRuntimeAvailable()) {
      pendingHouseSnapshot = payload
      promise.resolve(false)
      return
    }

    pendingHouseSnapshot = payload
    val activity = currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Nao ha Activity ativa para abrir a Casa da Bee.")
      return
    }

    try {
      val intent = Intent(activity, Class.forName(UNITY_ACTIVITY_CLASS))
      intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
      intent.putExtra(EXTRA_HOUSE_SNAPSHOT, payload)
      activity.startActivity(intent)
      schedulePendingFlush()
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("UNITY_OPEN_FAILED", error.message ?: "Falha ao abrir o modulo Unity.")
    }
  }

  @ReactMethod
  fun sendTask(payload: String, promise: Promise) {
    pendingTaskPayload = payload
    if (!isUnityRuntimeAvailable()) {
      promise.resolve(false)
      return
    }

    val sent = sendUnityMessage(BRIDGE_GAME_OBJECT, APPLY_TASK_METHOD, payload)
    if (!sent) {
      schedulePendingFlush()
    }
    promise.resolve(sent)
  }

  private fun schedulePendingFlush() {
    val delays = longArrayOf(400L, 900L, 1600L, 2600L, 4200L)
    for (delay in delays) {
      mainHandler.postDelayed({ flushPendingMessages() }, delay)
    }
  }

  private fun flushPendingMessages() {
    pendingHouseSnapshot?.let { snapshot ->
      if (sendUnityMessage(BRIDGE_GAME_OBJECT, APPLY_SNAPSHOT_METHOD, snapshot)) {
        pendingHouseSnapshot = null
      }
    }

    pendingTaskPayload?.let { task ->
      if (sendUnityMessage(BRIDGE_GAME_OBJECT, APPLY_TASK_METHOD, task)) {
        pendingTaskPayload = null
      }
    }
  }

  private fun isUnityRuntimeAvailable(): Boolean {
    return try {
      Class.forName(UNITY_PLAYER_CLASS)
      Class.forName(UNITY_ACTIVITY_CLASS)
      true
    } catch (_: Throwable) {
      false
    }
  }

  private fun sendUnityMessage(gameObject: String, method: String, payload: String): Boolean {
    return try {
      val unityPlayer = Class.forName(UNITY_PLAYER_CLASS)
      val sendMessage = unityPlayer.getMethod(
        "UnitySendMessage",
        String::class.java,
        String::class.java,
        String::class.java
      )
      sendMessage.invoke(null, gameObject, method, payload)
      true
    } catch (_: Throwable) {
      false
    }
  }

  companion object {
    const val NAME = "BeeHouseUnity"
    const val EXTRA_HOUSE_SNAPSHOT = "bee_house_snapshot"

    private const val UNITY_PLAYER_CLASS = "com.unity3d.player.UnityPlayer"
    private const val UNITY_ACTIVITY_CLASS = "com.unity3d.player.UnityPlayerActivity"
    private const val BRIDGE_GAME_OBJECT = "BeeHouseBridge"
    private const val APPLY_TASK_METHOD = "ApplyTaskStatus"
    private const val APPLY_SNAPSHOT_METHOD = "ApplyHouseSnapshot"

    @Volatile
    private var pendingHouseSnapshot: String? = null

    @Volatile
    private var pendingTaskPayload: String? = null
  }
}
