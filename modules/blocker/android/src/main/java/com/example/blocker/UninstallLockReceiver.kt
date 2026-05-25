package com.example.blocker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class UninstallLockReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != UninstallLockManager.ACTION_UNINSTALL_LOCK_EXPIRED) return

    val repository = PolicyRepository(context)
    UninstallLockManager(context, repository).releaseExpiredLock()
  }
}
