#version 120

#if @useUBO
    #extension GL_ARB_uniform_buffer_object : require
#endif

#if @useGPUShader4
    #extension GL_EXT_gpu_shader4: require
#endif

varying vec2 uv;

uniform sampler2D diffuseMap;

#if @normalMap
uniform sampler2D normalMap;
#endif

#if @blendMap
uniform sampler2D blendMap;
#endif

varying float euclideanDepth;
varying float linearDepth;

#define PER_PIXEL_LIGHTING (@normalMap || @specularMap || @forcePPL)

#if !PER_PIXEL_LIGHTING
centroid varying vec3 passLighting;
centroid varying vec3 passSpecular;
centroid varying vec3 shadowDiffuseLighting;
centroid varying vec3 shadowSpecularLighting;
#endif
varying vec3 passViewPos;
varying vec3 passNormal;

uniform vec2 screenRes;
uniform float far;

#include "vertexcolors.glsl"
#include "shadows_fragment.glsl"
#include "lib/light/lighting.glsl"
#include "lib/material/parallax.glsl"
#include "fog.glsl"
#include "compatibility/normals.glsl"

void main()
{
    vec2 adjustedUV = (gl_TextureMatrix[0] * vec4(uv, 0.0, 1.0)).xy;

    float height = 0.0;
#if @parallax
    height = texture2D(normalMap, adjustedUV).a;
    adjustedUV += getParallaxOffset(transpose(normalToViewMatrix) * normalize(-passViewPos), height);
#elif @normalMap
    height = texture2D(normalMap, adjustedUV).a;
#endif

    vec4 diffuseTex = texture2D(diffuseMap, adjustedUV);
    gl_FragData[0] = vec4(diffuseTex.xyz, 1.0);

    vec4 diffuseColor = getDiffuseColor();
    gl_FragData[0].a *= diffuseColor.a;

    float blendAlpha = 1.0;
#if @blendMap
    vec2 blendMapUV = (gl_TextureMatrix[1] * vec4(uv, 0.0, 1.0)).xy;
    blendAlpha = texture2D(blendMap, blendMapUV).a;
    gl_FragData[0].a *= blendAlpha;
#endif

#if @normalMap
    vec4 normalTex = texture2D(normalMap, adjustedUV);
    vec3 normal = normalTex.xyz * 2.0 - 1.0;
#if @reconstructNormalZ
    normal.z = sqrt(1.0 - dot(normal.xy, normal.xy));
#endif
    vec3 viewNormal = normalToView(normal);
#else
    vec3 viewNormal = normalize(gl_NormalMatrix * passNormal);
#endif

    float shadowing = unshadowedLightRatio(linearDepth);
    vec3 lighting, specular;
#if !PER_PIXEL_LIGHTING
    lighting = passLighting + shadowDiffuseLighting * shadowing;
    specular = passSpecular + shadowSpecularLighting * shadowing;
#else
#if @specularMap
    float shininess = 128.0; // TODO: make configurable
    vec3 specularColor = vec3(diffuseTex.a);
#else
    float shininess = gl_FrontMaterial.shininess;
    vec3 specularColor = getSpecularColor().xyz;
#endif
    vec3 diffuseLight, ambientLight, specularLight;
    doLighting(passViewPos, viewNormal, shininess, shadowing, diffuseLight, ambientLight, specularLight);
    lighting = diffuseColor.xyz * diffuseLight + getAmbientColor().xyz * ambientLight + getEmissionColor().xyz;
    specular = specularColor * specularLight;
#endif

    clampLightingResult(lighting);
    gl_FragData[0].xyz = gl_FragData[0].xyz * lighting + specular;

    gl_FragData[0] = applyFogAtDist(gl_FragData[0], euclideanDepth, linearDepth, far);

    // ---- PREMULTIPLY TERRAIN ALPHA ----
    // We multiply our RGB/A values by the layer's blend weight in the shader.
    // Coupled with GL_ONE, GL_ONE blending in material.cpp, this prevents the hardware
    // from blending MRTs incorrectly based on their respective alpha channels,
    // allowing you to store anything (like height or gloss) in the alpha channels!
    float targetAlpha = gl_FragData[0].a;
    gl_FragData[0].xyz *= targetAlpha;
    // We allow gl_FragData[0].a to remain targetAlpha so it sums to 1.0 in the framebuffer

#if !@disableNormals && @writeNormals
    // To encode height into normal map alpha, you can change 1.0 below to your height variable.
    // e.g. vec4 normalOut = vec4(viewNormal * 0.5 + 0.5, height);
    vec4 normalOut = vec4(viewNormal * 0.5 + 0.5, 1.0);
    gl_FragData[1] = normalOut * targetAlpha;
#endif

#if !@disableSpec && @writeNormals
    // To encode gloss into specular alpha, you can change 1.0 below to your gloss variable.
    // e.g. vec4 specOut = vec4(0.0, 0.0, 0.0, gloss);
    vec4 specOut = vec4(1.0, 1.0, 1.0, diffuseTex.a);
    gl_FragData[2] = specOut * targetAlpha;
#endif

    applyShadowDebugOverlay();
}
