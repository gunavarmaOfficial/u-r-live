import React from 'react';

interface ThreeDIconProps {
  className?: string;
  size?: number | string;
}

/**
 * 3D Stylized Male Avatar
 * Crafted with multi-layer spherical lighting, glossy 3D clay finish,
 * metallic audio headphones, volumetric hair, and realistic studio ambient occlusion.
 */
export const ThreeDMaleAvatar: React.FC<ThreeDIconProps> = ({ className = 'w-14 h-14', size }) => {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <defs>
        {/* Ambient Drop Shadow */}
        <radialGradient id="maleShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* 3D Skin Gradient with Warm Key Light */}
        <radialGradient id="maleFace" cx="38%" cy="32%" r="62%">
          <stop offset="0%" stopColor="#FFDFC4" />
          <stop offset="45%" stopColor="#F5B289" />
          <stop offset="85%" stopColor="#D98256" />
          <stop offset="100%" stopColor="#AC5A32" />
        </radialGradient>

        {/* 3D Neck Shadow */}
        <linearGradient id="maleNeck" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#9C4724" />
          <stop offset="100%" stopColor="#D98256" />
        </linearGradient>

        {/* Volumetric Hair Gradient */}
        <radialGradient id="maleHair" cx="35%" cy="25%" r="70%">
          <stop offset="0%" stopColor="#5B4033" />
          <stop offset="40%" stopColor="#301E17" />
          <stop offset="100%" stopColor="#140C08" />
        </radialGradient>

        {/* Hair Specular Light */}
        <linearGradient id="hairHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#966C52" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#966C52" stopOpacity="0" />
        </linearGradient>

        {/* 3D Hoodie Body Gradient */}
        <radialGradient id="maleHoodie" cx="40%" cy="25%" r="75%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="60%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#0F172A" />
        </radialGradient>

        {/* Headphone Metallic Ring */}
        <linearGradient id="hpBand" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#64748B" />
          <stop offset="50%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        {/* Headphone Ear Cushions */}
        <radialGradient id="hpCushion" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="60%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#082F49" />
        </radialGradient>
      </defs>

      {/* Ground Contact Shadow */}
      <ellipse cx="60" cy="114" rx="42" ry="6" fill="url(#maleShadow)" />

      {/* 3D Body / Shoulders */}
      <path
        d="M26 112 C26 90 38 82 60 82 C82 82 94 90 94 112 Z"
        fill="url(#maleHoodie)"
      />
      {/* Hoodie Collar Fold */}
      <path
        d="M44 86 Q60 98 76 86 Q60 102 44 86"
        fill="#1E40AF"
      />
      <circle cx="60" cy="92" r="3.5" fill="#93C5FD" opacity="0.8" />

      {/* 3D Neck */}
      <rect x="52" y="66" width="16" height="20" rx="6" fill="url(#maleNeck)" />

      {/* Headphone Arch Behind Head */}
      <path
        d="M24 54 C24 24 96 24 96 54"
        stroke="url(#hpBand)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      {/* 3D Head Sphere */}
      <ellipse cx="60" cy="54" rx="27" ry="30" fill="url(#maleFace)" />

      {/* Ears */}
      <ellipse cx="32" cy="55" rx="5" ry="8" fill="url(#maleFace)" />
      <ellipse cx="88" cy="55" rx="5" ry="8" fill="url(#maleFace)" />

      {/* 3D Hair - Layered Sculpted Clay Look */}
      <path
        d="M32 46 C32 20 44 14 62 14 C80 14 89 22 89 42 C85 36 78 32 68 33 C56 34 50 39 42 38 C36 37 34 42 32 46 Z"
        fill="url(#maleHair)"
      />
      {/* Hair Crest highlight */}
      <path
        d="M48 18 C58 14 74 16 80 24"
        stroke="url(#hairHighlight)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Eyebrows */}
      <path d="M42 46 Q49 43 54 46" stroke="#26170E" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M66 46 Q71 43 78 46" stroke="#26170E" strokeWidth="2.5" strokeLinecap="round" />

      {/* 3D Eyes with Specular Sparkle */}
      <ellipse cx="48" cy="52" rx="4" ry="4.5" fill="#1C1917" />
      <circle cx="46.5" cy="50.5" r="1.5" fill="#FFFFFF" />
      <circle cx="49.5" cy="53.5" r="0.7" fill="#FFFFFF" opacity="0.7" />

      <ellipse cx="72" cy="52" rx="4" ry="4.5" fill="#1C1917" />
      <circle cx="70.5" cy="50.5" r="1.5" fill="#FFFFFF" />
      <circle cx="73.5" cy="53.5" r="0.7" fill="#FFFFFF" opacity="0.7" />

      {/* 3D Nose Tip with Light Point */}
      <path d="M58 55 Q60 61 63 60" stroke="#C4683C" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="61" cy="59" r="1.5" fill="#FFE2CE" opacity="0.7" />

      {/* Friendly Smile */}
      <path d="M50 67 Q60 75 70 67" stroke="#7C2D12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M53 68 Q60 74 67 68" fill="#FFFFFF" />

      {/* Cheerful Cheek Glow */}
      <ellipse cx="41" cy="58" rx="4.5" ry="3" fill="#EF4444" opacity="0.22" />
      <ellipse cx="79" cy="58" rx="4.5" ry="3" fill="#EF4444" opacity="0.22" />

      {/* 3D Headphone Cups Left & Right */}
      <g>
        <ellipse cx="23" cy="54" rx="7" ry="11" fill="url(#hpCushion)" />
        <ellipse cx="23" cy="54" rx="3.5" ry="6" fill="#0284C7" />
        <ellipse cx="21" cy="52" rx="1.5" ry="3" fill="#BAE6FD" opacity="0.8" />
      </g>
      <g>
        <ellipse cx="97" cy="54" rx="7" ry="11" fill="url(#hpCushion)" />
        <ellipse cx="97" cy="54" rx="3.5" ry="6" fill="#0284C7" />
        <ellipse cx="95" cy="52" rx="1.5" ry="3" fill="#BAE6FD" opacity="0.8" />
      </g>
    </svg>
  );
};

/**
 * 3D Stylized Female Avatar
 * Crafted with warm studio rim light, volumetric silky hair,
 * glowing pearl earrings, soft 3D clay aesthetic, and elegant posture.
 */
export const ThreeDFemaleAvatar: React.FC<ThreeDIconProps> = ({ className = 'w-14 h-14', size }) => {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <defs>
        {/* Soft Ambient Ground Shadow */}
        <radialGradient id="femShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* 3D Skin Gradient with Soft Radiant Pink Lighting */}
        <radialGradient id="femFace" cx="36%" cy="32%" r="62%">
          <stop offset="0%" stopColor="#FFE8D6" />
          <stop offset="45%" stopColor="#F8BA9A" />
          <stop offset="85%" stopColor="#E08367" />
          <stop offset="100%" stopColor="#B85638" />
        </radialGradient>

        {/* 3D Neck Shadow */}
        <linearGradient id="femNeck" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#A84325" />
          <stop offset="100%" stopColor="#E2896D" />
        </linearGradient>

        {/* Rich Chestnut / Dark Amber 3D Hair */}
        <radialGradient id="femHair" cx="38%" cy="22%" r="72%">
          <stop offset="0%" stopColor="#78350F" />
          <stop offset="45%" stopColor="#451A03" />
          <stop offset="100%" stopColor="#1C0A00" />
        </radialGradient>

        {/* Hair Gloss Highlight */}
        <linearGradient id="femHairGlow" x1="0%" y1="0%" x2="100%" y2="80%">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#B45309" stopOpacity="0" />
        </linearGradient>

        {/* 3D Chic Outfit Gradient (Rose / Coral) */}
        <radialGradient id="femTop" cx="40%" cy="25%" r="75%">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="55%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#4C0519" />
        </radialGradient>

        {/* Glowing Pearl Gradient */}
        <radialGradient id="pearlGlow" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#CA8A04" />
        </radialGradient>
      </defs>

      {/* Ground Contact Shadow */}
      <ellipse cx="60" cy="114" rx="42" ry="6" fill="url(#femShadow)" />

      {/* Long Hair Flowing Behind Shoulders */}
      <path
        d="M25 50 C20 75 22 105 32 112 C42 112 40 85 40 60 Z"
        fill="#2A0F03"
      />
      <path
        d="M95 50 C100 75 98 105 88 112 C78 112 80 85 80 60 Z"
        fill="#2A0F03"
      />

      {/* 3D Top / Dress */}
      <path
        d="M28 112 C28 92 40 84 60 84 C80 84 92 92 92 112 Z"
        fill="url(#femTop)"
      />
      {/* Delicate V-Neck Collar */}
      <path
        d="M48 84 Q60 96 72 84 Q60 102 48 84"
        fill="#BE123C"
      />
      {/* Gold Pendant */}
      <circle cx="60" cy="94" r="3" fill="#FBBF24" />
      <circle cx="59.5" cy="93.5" r="1" fill="#FFFFFF" />

      {/* 3D Graceful Neck */}
      <rect x="53" y="66" width="14" height="20" rx="5" fill="url(#femNeck)" />

      {/* 3D Face Form */}
      <ellipse cx="60" cy="53" rx="25" ry="28" fill="url(#femFace)" />

      {/* Ears */}
      <ellipse cx="34" cy="54" rx="4" ry="7" fill="url(#femFace)" />
      <ellipse cx="86" cy="54" rx="4" ry="7" fill="url(#femFace)" />

      {/* Glowing 3D Pearl Earrings */}
      <circle cx="34" cy="62" r="3" fill="url(#pearlGlow)" />
      <circle cx="33" cy="61" r="1" fill="#FFFFFF" />
      <circle cx="86" cy="62" r="3" fill="url(#pearlGlow)" />
      <circle cx="85" cy="61" r="1" fill="#FFFFFF" />

      {/* Volumetric Front Hair & Bangs */}
      <path
        d="M32 46 C30 20 44 13 60 13 C76 13 90 20 88 46 C80 34 72 26 60 26 C46 26 38 34 32 46 Z"
        fill="url(#femHair)"
      />
      {/* Side Framing Locks */}
      <path
        d="M32 44 C31 56 34 68 37 72 C39 64 36 52 35 44 Z"
        fill="#3A1504"
      />
      <path
        d="M88 44 C89 56 86 68 83 72 C81 64 84 52 85 44 Z"
        fill="#3A1504"
      />

      {/* Hair Specular Light Arc */}
      <path
        d="M44 19 C54 15 68 15 76 21"
        stroke="url(#femHairGlow)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Delicate Eyebrows */}
      <path d="M43 45 Q49 41 55 44" stroke="#451A03" strokeWidth="2" strokeLinecap="round" />
      <path d="M65 44 Q71 41 77 45" stroke="#451A03" strokeWidth="2" strokeLinecap="round" />

      {/* Big Expressive 3D Eyes with Eyelashes & Gloss */}
      <path d="M42 49 Q48 46 54 50" stroke="#1C1917" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <ellipse cx="48" cy="52" rx="4" ry="4.5" fill="#1C1917" />
      <circle cx="47" cy="50.5" r="1.6" fill="#FFFFFF" />
      <circle cx="49.5" cy="53.5" r="0.7" fill="#FFFFFF" opacity="0.8" />

      <path d="M66 50 Q72 46 78 49" stroke="#1C1917" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <ellipse cx="72" cy="52" rx="4" ry="4.5" fill="#1C1917" />
      <circle cx="71" cy="50.5" r="1.6" fill="#FFFFFF" />
      <circle cx="73.5" cy="53.5" r="0.7" fill="#FFFFFF" opacity="0.8" />

      {/* Cute Nose Tip */}
      <path d="M59 55 Q60 59 62 58" stroke="#D97757" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="60.5" cy="57.5" r="1.2" fill="#FFF1E8" opacity="0.8" />

      {/* Soft Rosy Cheeks */}
      <ellipse cx="42" cy="58" rx="5" ry="3.5" fill="#F43F5E" opacity="0.28" />
      <ellipse cx="78" cy="58" rx="5" ry="3.5" fill="#F43F5E" opacity="0.28" />

      {/* Radiant Smile with Gloss */}
      <path d="M51 66 Q60 74 69 66" stroke="#9F1239" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M53 67 Q60 73 67 67" fill="#FFFFFF" />
      <circle cx="60" cy="71.5" r="1.5" fill="#FDA4AF" opacity="0.7" />
    </svg>
  );
};

/**
 * 3D Stylized Non-Binary / Other Avatar
 * Crafted with modern stylish aesthetic, purple neon jacket,
 * trendy gradient-tinted sunglasses, volumetric clay hair, and sleek lighting.
 */
export const ThreeDOtherAvatar: React.FC<ThreeDIconProps> = ({ className = 'w-14 h-14', size }) => {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <defs>
        <radialGradient id="othShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="othFace" cx="36%" cy="30%" r="62%">
          <stop offset="0%" stopColor="#FFE4D6" />
          <stop offset="45%" stopColor="#F5B292" />
          <stop offset="85%" stopColor="#D97858" />
          <stop offset="100%" stopColor="#A84C32" />
        </radialGradient>

        <linearGradient id="othNeck" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#9C442A" />
          <stop offset="100%" stopColor="#D97858" />
        </linearGradient>

        {/* Trendy Lilac / Platinum 3D Hair */}
        <radialGradient id="othHair" cx="35%" cy="22%" r="75%">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="45%" stopColor="#7E22CE" />
          <stop offset="100%" stopColor="#3B0764" />
        </radialGradient>

        {/* 3D Cyber Purple Jacket */}
        <radialGradient id="othJacket" cx="40%" cy="25%" r="75%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="55%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#1E1B4B" />
        </radialGradient>

        {/* 3D Gradient Sunglasses Lens */}
        <linearGradient id="sunglassLens" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F43F5E" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>

      {/* Ground Contact Shadow */}
      <ellipse cx="60" cy="114" rx="42" ry="6" fill="url(#othShadow)" />

      {/* 3D Modern Jacket */}
      <path
        d="M26 112 C26 90 38 82 60 82 C82 82 94 90 94 112 Z"
        fill="url(#othJacket)"
      />
      {/* High Tech Collar */}
      <path
        d="M46 84 L60 98 L74 84 Z"
        fill="#312E81"
      />
      <circle cx="60" cy="91" r="3" fill="#A5B4FC" opacity="0.9" />

      {/* Neck */}
      <rect x="52" y="66" width="16" height="20" rx="6" fill="url(#othNeck)" />

      {/* Head Form */}
      <ellipse cx="60" cy="54" rx="26" ry="29" fill="url(#othFace)" />

      {/* Ears with Silver Cuffs */}
      <ellipse cx="33" cy="55" rx="4" ry="7" fill="url(#othFace)" />
      <circle cx="32" cy="53" r="1.5" fill="#E2E8F0" />
      <circle cx="32" cy="57" r="1.5" fill="#E2E8F0" />

      <ellipse cx="87" cy="55" rx="4" ry="7" fill="url(#othFace)" />
      <circle cx="88" cy="55" r="1.5" fill="#E2E8F0" />

      {/* 3D Sculpted Trendy Modern Hair (Volumetric Wave) */}
      <path
        d="M30 46 C30 18 45 12 62 12 C82 12 90 22 89 44 C84 34 76 30 65 31 C52 32 46 36 38 34 C33 33 31 38 30 46 Z"
        fill="url(#othHair)"
      />
      {/* Hair Specular Light */}
      <path
        d="M46 17 C58 13 74 15 82 23"
        stroke="#E9D5FF"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />

      {/* 3D Gradient Sunglasses */}
      <g>
        {/* Frame Bridge */}
        <rect x="56" y="49" width="8" height="3" rx="1.5" fill="#0F172A" />

        {/* Left Lens */}
        <rect x="37" y="46" width="20" height="13" rx="4" fill="url(#sunglassLens)" />
        <rect x="37" y="46" width="20" height="13" rx="4" stroke="#0F172A" strokeWidth="1.5" fill="none" />
        {/* Specular White Stripe on Lens */}
        <line x1="40" y1="48" x2="48" y2="56" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />

        {/* Right Lens */}
        <rect x="63" y="46" width="20" height="13" rx="4" fill="url(#sunglassLens)" />
        <rect x="63" y="46" width="20" height="13" rx="4" stroke="#0F172A" strokeWidth="1.5" fill="none" />
        {/* Specular White Stripe on Lens */}
        <line x1="66" y1="48" x2="74" y2="56" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
      </g>

      {/* 3D Nose Tip */}
      <circle cx="60.5" cy="62" r="1.5" fill="#FFEAE0" opacity="0.8" />

      {/* Confident Smile */}
      <path d="M51 68 Q60 75 69 68" stroke="#7C2D12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M54 69 Q60 74 66 69" fill="#FFFFFF" />

      {/* Subtle Purple Neon Ambient Rim Glow */}
      <ellipse cx="42" cy="61" rx="4.5" ry="3" fill="#A855F7" opacity="0.25" />
      <ellipse cx="78" cy="61" rx="4.5" ry="3" fill="#A855F7" opacity="0.25" />
    </svg>
  );
};

/**
 * 3D Holographic Global Planet Icon
 * High-gloss emerald sphere with neon latitude rings, orbital sat rings,
 * illuminated continental nodes, and spherical glass reflections.
 */
export const ThreeDGlobeIcon: React.FC<ThreeDIconProps> = ({ className = 'w-14 h-14', size }) => {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <defs>
        {/* Deep Space Shadow */}
        <radialGradient id="globeShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* 3D Glowing Emerald Sphere */}
        <radialGradient id="globeSphere" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="35%" stopColor="#10B981" />
          <stop offset="70%" stopColor="#047857" />
          <stop offset="100%" stopColor="#022C22" />
        </radialGradient>

        {/* Glass Specular Reflection */}
        <radialGradient id="globeGloss" cx="35%" cy="25%" r="45%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#6EE7B7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </radialGradient>

        {/* Orbital Neon Ring Gradient */}
        <linearGradient id="orbitRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#34D399" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#065F46" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Ground Glow Shadow */}
      <ellipse cx="60" cy="112" rx="40" ry="6" fill="url(#globeShadow)" />

      {/* Rear Orbit Ring Segment */}
      <path
        d="M16 66 C18 48 102 36 104 54"
        stroke="url(#orbitRing)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />

      {/* Main 3D Sphere */}
      <circle cx="60" cy="58" r="38" fill="url(#globeSphere)" />

      {/* Continental Landforms (3D Stylized Organic Shapes) */}
      <path
        d="M42 42 C45 35 55 36 58 42 C60 48 52 54 48 56 C44 58 38 52 42 42 Z"
        fill="#A7F3D0"
        opacity="0.9"
      />
      <path
        d="M66 38 C72 34 82 38 84 46 C85 54 78 58 72 56 C68 54 64 44 66 38 Z"
        fill="#A7F3D0"
        opacity="0.85"
      />
      <path
        d="M48 68 C52 64 62 66 64 74 C65 82 56 86 50 84 C46 82 44 72 48 68 Z"
        fill="#A7F3D0"
        opacity="0.9"
      />
      <path
        d="M74 66 C78 62 86 64 88 70 C89 76 82 80 76 78 C72 76 72 70 74 66 Z"
        fill="#A7F3D0"
        opacity="0.85"
      />

      {/* Grid Latitude / Longitude Curvature Lines */}
      <ellipse cx="60" cy="58" rx="20" ry="37" stroke="#6EE7B7" strokeWidth="1.2" strokeDasharray="3 2" fill="none" opacity="0.4" />
      <ellipse cx="60" cy="58" rx="37" ry="14" stroke="#6EE7B7" strokeWidth="1.2" strokeDasharray="3 2" fill="none" opacity="0.4" />

      {/* Glowing Network Connection Nodes & Pulses */}
      <circle cx="50" cy="46" r="2.5" fill="#FFFFFF" />
      <circle cx="76" cy="46" r="2" fill="#FFFFFF" />
      <circle cx="56" cy="74" r="2" fill="#FFFFFF" />
      <circle cx="80" cy="72" r="2" fill="#FFFFFF" />

      {/* Node Linking Lines */}
      <line x1="50" y1="46" x2="76" y2="46" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 1" opacity="0.75" />
      <line x1="50" y1="46" x2="56" y2="74" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 1" opacity="0.6" />
      <line x1="76" y1="46" x2="80" y2="72" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 1" opacity="0.6" />

      {/* Front Orbit Ring Segment Passing In Front of Globe */}
      <path
        d="M104 54 C102 72 18 84 16 66"
        stroke="url(#orbitRing)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Orbiting Satellite Dot */}
      <circle cx="96" cy="65" r="3.5" fill="#FFFFFF" />
      <circle cx="96" cy="65" r="6" stroke="#6EE7B7" strokeWidth="1" opacity="0.6" />

      {/* Glass Dome Spherical Highlight */}
      <ellipse cx="46" cy="40" rx="20" ry="14" fill="url(#globeGloss)" />
      <circle cx="42" cy="34" r="3" fill="#FFFFFF" opacity="0.8" />
    </svg>
  );
};
