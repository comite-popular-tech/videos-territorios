// Entrada do Remotion só do vídeo "O dinheiro que gira" (INSS): a composição InssInfo (src/InfoInss.tsx), renderizada
// por video/inss_render.mjs. Fica fora do Root.tsx para não mexer na Historia que os outros vídeos usam.
import { registerRoot } from 'remotion';
import { InssRoot } from './InfoInss';

registerRoot(InssRoot);
