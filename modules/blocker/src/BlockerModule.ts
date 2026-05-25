import { requireNativeModule } from 'expo';

import type { BlockerNativeModule } from '../../../src/types/blocker';

export default requireNativeModule<BlockerNativeModule>('BlockerModule');
