#version 120

#include "lib/core/vertex.h.glsl"

varying vec4  position;
varying float linearDepth;

#include "shadows_vertex.glsl"
#include "lib/view/depth.glsl"

uniform vec3 nodePosition;
uniform vec3 playerPos;

varying vec3 worldPos;
varying vec2 rippleMapUV;

#if @rainRippleOcclusion
uniform mat4 rainOcclusionMatrix;
varying vec3 rainOcclusionCoord;
#endif

void main(void)
{
    gl_Position = modelToClip(gl_Vertex);

    position = gl_Vertex;

    worldPos = position.xyz + nodePosition.xyz;
    rippleMapUV = (worldPos.xy - playerPos.xy + (@rippleMapSize * @rippleMapWorldScale / 2.0)) / @rippleMapSize / @rippleMapWorldScale;

#if @rainRippleOcclusion
    // Transform world position to precipitation occlusion depth space
    vec4 occlusionClipPos = rainOcclusionMatrix * vec4(worldPos, 1.0);
    // Convert from clip/NDC space to texture space [0,1]
    // XY are always in [-1,1] NDC range, so we apply * 0.5 + 0.5
    // Z handling depends on depth buffer mode:
    //   - Reversed-Z with GL_ZERO_TO_ONE: NDC z is already in [0,1], no transformation needed
    //   - Standard Z: NDC z is in [-1,1], needs * 0.5 + 0.5
#if @reverseZ
    rainOcclusionCoord = vec3(occlusionClipPos.xy * 0.5 + 0.5, occlusionClipPos.z);
#else
    rainOcclusionCoord = occlusionClipPos.xyz * 0.5 + 0.5;
#endif
#endif

    vec4 viewPos = modelToView(gl_Vertex);
    linearDepth = getLinearDepth(gl_Position.z, viewPos.z);

    setupShadowCoords(viewPos, normalize((gl_NormalMatrix * gl_Normal).xyz));
}
