# Normal Map RT Blending Fix

**Date:** April 9, 2026
**Issue:** Updating to the newest OpenMW base broke normal map blending (e.g. for terrain splats over normal map G-buffers) because the base OpenMW code intentionally disables `GL_BLEND` on render target 1 (the normals buffer) to save performance and prevent unwanted bleeding.
**Fix:**
Removed `stateset->setAttributeAndModes(new osg::Disablei(GL_BLEND, 1));` from `SceneManager::setUpNormalsRTForStateSet` in `components/resource/scenemanager.cpp`.

This change allows the normal maps from alpha-blended passes (like terrain splat textures) to correctly utilize the alpha value returned to `gl_FragData[1]` to blend with the underlying layer's normal map, which is crucial for custom post-processing systems wanting blended normals from the MRT target.

**Relevant files touched:**
* `components/resource/scenemanager.cpp`

---

## Multiple Render Target (MRT) Alpha Blending & Specular Exposure Fix

**Date:** April 10, 2026
**Issue:** Adding a 4th channel (Height/Gloss) to `gl_FragData[1]` (Normals) and `gl_FragData[2]` (Specular) on terrain broke layer blending. This occurred because OpenMW's terrain used `GL_SRC_ALPHA` hardware blending, causing the hardware to use the newly-added data channels (Height/Gloss) as the blending weights for the entire layer, rather than using the terrain's blendmap.

**Fix (Premultiplied Alpha):**
1. **Material Logic:** Updated `components/terrain/material.cpp` to use `GL_ONE, GL_ZERO` (first layer) and `GL_ONE, GL_ONE` (subsequent layers) instead of `GL_SRC_ALPHA`. 
2. **Shader Logic:** Updated `terrain.frag` and `terrain_composite.frag` to manually premultiply all MRT outputs by the layer's blend alpha internally (`gl_FragData[n] *= targetAlpha`). This decouples the hardware blend state from the attachment alpha values.
3. **Internal Data Exposure:**
   - **Normals MRT (`gl_FragData[1]`)**: Alpha is now free for Height data (presently defaults to `1.0 * targetAlpha`).
   - **Specular MRT (`gl_FragData[2]`)**:
     - RGB: Fixed to `1.0` (White) to provide a base specular color.
     - Alpha: Mapped to the diffuse texture's alpha channel (`diffuseTex.a`). This allows "diffusespec" textures to drive gloss/specular-alpha for post-processing.

**Relevant files touched:**
* `components/terrain/material.cpp`
* `files/shaders/compatibility/terrain.frag`
* `files/shaders/compatibility/terrain_composite.frag`
* `c:/Modding/OpenMWOverhaul/custom/Shaders/RafaelsShaderPack/Shaders/TestDebugger.omwfx` (Fixed for 4th channel visualization)

