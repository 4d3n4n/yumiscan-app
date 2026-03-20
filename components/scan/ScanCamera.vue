<script setup lang="ts">
import { PhCaretLeft, PhLightning, PhArrowsLeftRight, PhInfo, PhImages } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  facingMode: 'environment' | 'user'
  error: string | null
}>()

const emit = defineEmits<{
  capture: [blob: Blob]
  back: []
  switchCamera: []
  clearError: []
  error: [message: string]
  openGallery: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const streamRef = ref<MediaStream | null>(null)
const hasTorchSupport = ref(false)
const isTorchOn = ref(false)

const startCamera = async () => {
  emit('clearError')
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error(t('scan.scan.camera.error_unsupported'))
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: props.facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
    })
    streamRef.value = stream
    const track = stream.getVideoTracks()[0]
    const caps = (track.getCapabilities?.() as { torch?: boolean }) ?? {}
    hasTorchSupport.value = !!caps.torch
    if (videoRef.value) { videoRef.value.srcObject = stream; await videoRef.value.play() }
  } catch (e) {
    emit('error', e instanceof Error ? e.message : t('scan.scan.camera.error_access'))
  }
}

const stopCamera = () => {
  streamRef.value?.getTracks().forEach(t => t.stop())
  streamRef.value = null
}

watch(() => props.facingMode, () => { stopCamera(); startCamera() })

onMounted(() => startCamera())
onUnmounted(() => stopCamera())

const toggleTorch = async () => {
  const stream = streamRef.value
  if (!stream) return
  const track = stream.getVideoTracks()[0]
  try {
    await track.applyConstraints({ advanced: [{ torch: !isTorchOn.value } as Record<string, unknown>] } as MediaTrackConstraints)
    isTorchOn.value = !isTorchOn.value
  } catch { hasTorchSupport.value = false }
}

const capture = () => {
  const video = videoRef.value
  const canvas = canvasRef.value
  if (!video || !canvas || !video.videoWidth) return
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  canvas.toBlob((blob) => { if (blob) emit('capture', blob) }, 'image/jpeg', 0.9)
}
</script>

<template>
  <div class="fixed inset-0 z-40 bg-black text-white flex flex-col touch-none">
    <div class="absolute inset-0 z-0">
      <video ref="videoRef" class="w-full h-full object-cover" playsinline muted />
      <div class="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 pointer-events-none" />
      <canvas ref="canvasRef" class="hidden" />
    </div>

    <!-- Top bar -->
    <div class="relative z-10 flex items-center justify-between px-4 py-3" style="padding-top: max(env(safe-area-inset-top), 12px);">
      <button
        class="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md border border-white/20 active:bg-black/50 transition-colors"
        @click="emit('back')"
      >
        <PhCaretLeft :size="20" weight="bold" />
      </button>
      <span class="text-sm font-black font-heading tracking-wider uppercase">{{ t('scan.scan.camera.title') }}</span>
      <button
        v-if="hasTorchSupport"
        class="w-10 h-10 flex items-center justify-center rounded-full backdrop-blur-md border border-white/20 transition-colors"
        :class="isTorchOn ? 'bg-amber-500 border-transparent' : 'bg-black/30 active:bg-black/50'"
        @click="toggleTorch"
      >
        <PhLightning :size="18" :weight="isTorchOn ? 'fill' : 'regular'" />
      </button>
      <div v-else class="w-10" />
    </div>

    <!-- Central viewfinder -->
    <div class="relative z-0 flex-1 flex flex-col items-center justify-center px-6 gap-5">

      <!-- Instruction badge -->
      <div
        class="px-5 py-2 text-sm font-bold tracking-wide"
        style="background: hsl(var(--primary)); border-radius: var(--bold-radius-pill); color: white;"
      >
        {{ t('scan.scan.camera.instruction_badge') }}
      </div>

      <!-- Viewfinder frame -->
      <div class="relative w-full aspect-[3/4] max-w-sm mx-auto">
        <!-- Corner brackets (primary color) -->
        <div class="absolute inset-0 pointer-events-none">
          <div class="absolute -top-1 -left-1 w-10 h-10 border-l-[3px] border-t-[3px] rounded-tl-md" style="border-color: hsl(var(--primary));" />
          <div class="absolute -top-1 -right-1 w-10 h-10 border-r-[3px] border-t-[3px] rounded-tr-md" style="border-color: hsl(var(--primary));" />
          <div class="absolute -bottom-1 -left-1 w-10 h-10 border-l-[3px] border-b-[3px] rounded-bl-md" style="border-color: hsl(var(--primary));" />
          <div class="absolute -bottom-1 -right-1 w-10 h-10 border-r-[3px] border-b-[3px] rounded-br-md" style="border-color: hsl(var(--primary));" />
        </div>
        <!-- Outer glow -->
        <div
          class="absolute -inset-3 pointer-events-none opacity-20"
          style="border: 2px solid hsl(var(--primary)); border-radius: 12px; filter: blur(8px);"
        />
      </div>

      <!-- Instructions -->
      <div class="text-center space-y-2 max-w-xs">
        <p class="text-white/90 font-semibold text-sm leading-snug">
          <i18n-t keypath="scan.scan.camera.instruction_text" scope="global">
            <template #br>
              <br>
            </template>
          </i18n-t>
        </p>
        <p class="flex items-center justify-center gap-1.5 text-white/50 text-xs font-medium uppercase tracking-wider">
          <PhInfo :size="14" weight="bold" />
          {{ t('scan.scan.camera.instruction_subtext') }}
        </p>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="relative z-10 mx-6 mb-4 p-4 rounded-xl bg-red-500/90 text-white text-sm text-center backdrop-blur-sm shadow-lg">
      {{ error }}
    </div>

    <!-- Bottom bar -->
    <div class="relative z-10 px-4 pb-4 flex items-end justify-between" style="padding-bottom: max(env(safe-area-inset-bottom), 24px);">
      <!-- Gallery import -->
      <button
        class="flex flex-col items-center gap-1 px-3 py-1"
        @click="emit('openGallery')"
      >
        <div class="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 border border-white/20">
          <PhImages :size="20" weight="bold" class="text-white/80" />
        </div>
        <span class="text-[10px] font-bold text-white/60 uppercase tracking-wider">{{ t('scan.scan.camera.btn_gallery') }}</span>
      </button>

      <!-- Capture button -->
      <button @click="capture" class="group relative flex items-center justify-center" :aria-label="t('scan.scan.camera.capture_aria')">
        <div class="w-[72px] h-[72px] rounded-full border-4 transition-transform group-active:scale-95" style="border-color: hsl(var(--primary));" />
        <div class="absolute w-[60px] h-[60px] rounded-full bg-white transition-all group-active:scale-90" />
      </button>

      <!-- Switch camera -->
      <button
        class="flex flex-col items-center gap-1 px-3 py-1"
        @click="emit('switchCamera')"
      >
        <div class="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 border border-white/20">
          <PhArrowsLeftRight :size="20" weight="bold" class="text-white/80" />
        </div>
        <span class="text-[10px] font-bold text-white/60 uppercase tracking-wider">{{ t('scan.scan.camera.btn_switch') }}</span>
      </button>
    </div>
  </div>
</template>
