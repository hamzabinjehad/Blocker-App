package com.example.blocker

import android.content.Context
import android.graphics.Bitmap
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.support.common.FileUtil
import org.tensorflow.lite.support.image.TensorImage

class NsfwClassifier(context: Context) : AutoCloseable {
  private val interpreter: Interpreter

  init {
    val model = FileUtil.loadMappedFile(context, MODEL_ASSET)
    interpreter = Interpreter(
      model,
      Interpreter.Options().apply {
        setNumThreads(2)
        setUseNNAPI(true)
      }
    )
  }

  fun isExplicit(bitmap: Bitmap, threshold: Float = BlockerConfig.imageScanThreshold): Boolean {
    val scaled = Bitmap.createScaledBitmap(bitmap, INPUT_SIZE, INPUT_SIZE, true)
    val input = TensorImage.fromBitmap(scaled)
    val output = Array(1) { FloatArray(LABEL_COUNT) }
    interpreter.run(input.buffer, output)
    val explicitScore = output[0][HENTAI_INDEX] + output[0][PORN_INDEX]
    scaled.recycle()
    return explicitScore > threshold
  }

  override fun close() {
    interpreter.close()
  }

  companion object {
    private const val MODEL_ASSET = "nsfw_model.tflite"
    private const val INPUT_SIZE = 224
    private const val LABEL_COUNT = 5
    private const val HENTAI_INDEX = 1
    private const val PORN_INDEX = 3
  }
}
