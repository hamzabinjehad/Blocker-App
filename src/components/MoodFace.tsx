import { View } from 'react-native';

type FaceConfig = {
  bg: string;
  eyeType: 'dot' | 'x' | 'arch' | 'line';
  mouthType: 'smile' | 'big-smile' | 'frown' | 'flat' | 'open-sad';
  cheeks?: boolean;
};

const FACE_CONFIGS: Record<string, FaceConfig> = {
  terrible:  { bg: '#C87878', eyeType: 'x',    mouthType: 'open-sad'               },
  excellent: { bg: '#F5A55A', eyeType: 'arch',  mouthType: 'big-smile', cheeks: true },
  bad:       { bg: '#9E7EC8', eyeType: 'dot',   mouthType: 'frown'                  },
  great:     { bg: '#E8D470', eyeType: 'arch',  mouthType: 'smile'                  },
  down:      { bg: '#7090D0', eyeType: 'line',  mouthType: 'flat'                   },
  neutral:   { bg: '#88C5E8', eyeType: 'dot',   mouthType: 'flat'                   },
  steady:    { bg: '#88C5E8', eyeType: 'arch',  mouthType: 'smile'                  },
  stressed:  { bg: '#C87878', eyeType: 'dot',   mouthType: 'frown'                  },
  bored:     { bg: '#9E7EC8', eyeType: 'line',  mouthType: 'flat'                   },
  tempted:   { bg: '#F5A55A', eyeType: 'dot',   mouthType: 'frown'                  },
  tired:     { bg: '#7090D0', eyeType: 'line',  mouthType: 'flat'                   },
};

export function MoodFace({ mood, size }: { mood: string; size: number }) {
  const cfg = FACE_CONFIGS[mood] ?? FACE_CONFIGS['neutral']!;
  const s = size / 80;
  const c = '#2a2a2a';
  const r = Math.round;

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center' }}>
      {cfg.cheeks && (
        <>
          <View style={{ position: 'absolute', left: r(9 * s), top: r(44 * s), width: r(14 * s), height: r(9 * s), borderRadius: r(5 * s), backgroundColor: 'rgba(210,80,60,0.28)' }} />
          <View style={{ position: 'absolute', right: r(9 * s), top: r(44 * s), width: r(14 * s), height: r(9 * s), borderRadius: r(5 * s), backgroundColor: 'rgba(210,80,60,0.28)' }} />
        </>
      )}
      <View style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', columnGap: r(16 * s), marginBottom: r(6 * s) }}>
          <EyeShape type={cfg.eyeType} s={s} c={c} />
          <EyeShape type={cfg.eyeType} s={s} c={c} />
        </View>
        <MouthShape type={cfg.mouthType} s={s} c={c} />
      </View>
    </View>
  );
}

function EyeShape({ type, s, c }: { type: FaceConfig['eyeType']; s: number; c: string }) {
  const r = Math.round;
  if (type === 'dot') {
    return <View style={{ width: r(8 * s), height: r(8 * s), borderRadius: r(4 * s), backgroundColor: c }} />;
  }
  if (type === 'x') {
    const sz = r(12 * s);
    const th = Math.max(2, r(2.5 * s));
    return (
      <View style={{ width: sz, height: sz, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: sz, height: th, backgroundColor: c, borderRadius: th / 2, transform: [{ rotate: '45deg' }] }} />
        <View style={{ position: 'absolute', width: sz, height: th, backgroundColor: c, borderRadius: th / 2, transform: [{ rotate: '-45deg' }] }} />
      </View>
    );
  }
  if (type === 'arch') {
    const w = r(13 * s);
    const bw = Math.max(2, r(2 * s));
    return (
      <View style={{ width: w, height: r(w / 2), overflow: 'hidden' }}>
        <View style={{ width: w, height: w, borderRadius: r(w / 2), borderWidth: bw, borderColor: c }} />
      </View>
    );
  }
  return <View style={{ width: r(12 * s), height: Math.max(2, r(2.5 * s)), backgroundColor: c, borderRadius: 2 }} />;
}

function MouthShape({ type, s, c }: { type: FaceConfig['mouthType']; s: number; c: string }) {
  const r = Math.round;
  if (type === 'smile' || type === 'big-smile') {
    const w = r((type === 'big-smile' ? 34 : 26) * s);
    const h = r(w / 2);
    const bw = Math.max(2, r(2.5 * s));
    return (
      <View style={{ width: w, height: h, overflow: 'hidden' }}>
        <View style={{ width: w, height: w, borderRadius: r(w / 2), borderWidth: bw, borderColor: c, marginTop: -h }} />
      </View>
    );
  }
  if (type === 'frown') {
    const w = r(26 * s);
    const h = r(w / 2);
    const bw = Math.max(2, r(2.5 * s));
    return (
      <View style={{ width: w, height: h, overflow: 'hidden' }}>
        <View style={{ width: w, height: w, borderRadius: r(w / 2), borderWidth: bw, borderColor: c }} />
      </View>
    );
  }
  if (type === 'open-sad') {
    return <View style={{ width: r(18 * s), height: r(12 * s), borderRadius: r(6 * s), backgroundColor: c }} />;
  }
  return <View style={{ width: r(24 * s), height: Math.max(2, r(2.5 * s)), backgroundColor: c, borderRadius: 2 }} />;
}
