// Thanos Power Grip Purple Blackhole Shader
window.ThanosPowerGripShader = class ThanosPowerGripShader extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(game) {
        super({
            game: game,
            renderer: game.renderer,
            fragShader: `
precision mediump float;
uniform float iTime;
uniform vec3 iResolution;

// Noise function for turbulence
float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Fractal Brownian Motion for organic swirling patterns
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

// Rotation matrix
mat2 rotate(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
}

// Hash function for particle generation
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Generate energy particles being sucked into blackhole
float energyParticles(vec2 uv, float time) {
    float particles = 0.0;
    
    // Grid for particle spawning
    vec2 grid = floor(uv * 20.0);
    vec2 cellPos = fract(uv * 20.0) - 0.5;
    
    // Random seed for this cell
    float seed = hash(grid);
    
    // Particle animation - spiral inward with time
    float particleTime = time + seed * 6.28; // Different start times
    float spiralSpeed = 2.0 + seed * 3.0;    // Different spiral speeds
    
    // Calculate particle position in spiral
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);
    
    // Create spiral path toward center
    float spiralAngle = angle + particleTime * spiralSpeed;
    float spiralRadius = 0.8 - fract(particleTime * 0.3) * 0.6; // Moves from outer to inner
    
    // Particle position on spiral
    vec2 particlePos = vec2(cos(spiralAngle), sin(spiralAngle)) * spiralRadius;
    
    // Distance to particle
    float particleDist = length(uv - particlePos);
    
    // Particle size and intensity
    float particleSize = 0.015 + seed * 0.01;
    float intensity = 1.0 - smoothstep(0.0, particleSize, particleDist);
    
    // Fade out as particle approaches center
    intensity *= smoothstep(0.0, 0.2, spiralRadius);
    
    // Multiple particle layers
    particles += intensity;
    
    return particles;
}

// Create energy drain streams
float drainStreams(vec2 uv, float time) {
    float streams = 0.0;
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);
    
    // Multiple drain streams at different angles
    for (int i = 0; i < 8; i++) {
        float streamAngle = float(i) * 0.785398; // 45 degree intervals
        float angleDiff = abs(angle - streamAngle);
        angleDiff = min(angleDiff, 6.28318 - angleDiff); // Wrap around
        
        // Stream width based on distance
        float streamWidth = 0.1 + dist * 0.05;
        float stream = 1.0 - smoothstep(0.0, streamWidth, angleDiff);
        
        // Animate stream intensity
        float pulse = sin(time * 5.0 + float(i)) * 0.5 + 0.5;
        stream *= pulse * 0.3;
        
        // Fade with distance
        stream *= (1.0 - smoothstep(0.2, 0.8, dist));
        
        streams += stream;
    }
    
    return streams;
}

void main() {
    // Normalize coordinates to center
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
    
    // Distance from center
    float dist = length(uv);
    
    // Angle for spiral effects
    float angle = atan(uv.y, uv.x);
    
    // Time-based rotation
    float time = iTime * 0.5;
    
    // Create swirling coordinates
    vec2 swirlUV = uv * rotate(time + dist * 3.0);
    
    // Blackhole event horizon (very dark center)
    float eventHorizon = smoothstep(0.0, 0.15, dist);
    
    // Accretion disk - bright swirling matter
    float accretionDisk = 0.0;
    
    // Multiple layers of swirling energy
    for (int i = 0; i < 3; i++) {
        float layer = float(i) + 1.0;
        float radius = 0.2 + layer * 0.1;
        float thickness = 0.05;
        
        // Spiral pattern
        vec2 spiralUV = uv * rotate(time * layer + angle * 2.0);
        float spiral = fbm(spiralUV * 8.0 + time * 2.0);
        
        // Ring of energy
        float ring = 1.0 - smoothstep(radius - thickness, radius + thickness, dist);
        ring *= smoothstep(0.0, 0.02, dist); // Don't show in center
        
        // Add turbulence
        ring *= (0.7 + 0.3 * spiral);
        
        accretionDisk += ring / layer; // Dimmer outer layers
    }
    
    // Gravitational lensing effect - distort space around blackhole
    vec2 lensedUV = uv;
    float lensStrength = 1.0 / (dist * dist + 0.01);
    lensedUV += normalize(uv) * lensStrength * 0.02;
    
    // Energy jets from poles
    float jetEffect = 0.0;
    if (abs(uv.x) < 0.02 && dist > 0.1) {
        jetEffect = (1.0 - abs(uv.x) / 0.02) * smoothstep(0.1, 0.6, dist);
        jetEffect *= (0.8 + 0.2 * sin(time * 10.0 + dist * 20.0));
    }
    
    // Hawking radiation glow
    float hawkingGlow = exp(-dist * 8.0) * (0.3 + 0.1 * sin(time * 15.0));
    
    // ENHANCED: Energy draining particles
    float particles = 0.0;
    
    // Reduced particle systems for better performance
    particles += energyParticles(uv, iTime * 2.0) * 0.6;
    particles += energyParticles(uv * 1.3, iTime * 1.8) * 0.3;
    
    // Energy drain streams
    float streams = drainStreams(uv, iTime);
    
    // Reduced pulsing energy waves for better performance
    float waves = 0.0;
    for (int w = 0; w < 3; w++) {
        float waveTime = iTime * 2.5 + float(w) * 1.5; // Fewer, slower waves
        float waveRadius = 0.7 - fract(waveTime * 0.3) * 0.5;
        float waveDist = abs(dist - waveRadius);
        float wave = exp(-waveDist * 40.0) * 0.2;
        waves += wave;
    }
    
    // Purple color palette
    vec3 deepPurple = vec3(0.2, 0.0, 0.4);      // Dark purple for outer regions
    vec3 brightPurple = vec3(0.8, 0.2, 1.0);    // Bright purple for energy
    vec3 magenta = vec3(1.0, 0.1, 0.8);         // Hot magenta for inner disk
    vec3 white = vec3(1.0, 0.9, 1.0);           // White-hot center
    vec3 electricBlue = vec3(0.3, 0.7, 1.0);    // Electric blue for particles
    
    // Combine all elements
    vec3 color = vec3(0.0);
    
    // Background space distortion
    color += deepPurple * (1.0 - eventHorizon) * 0.1;
    
    // Accretion disk coloring based on temperature (distance)
    if (accretionDisk > 0.0) {
        if (dist < 0.25) {
            color += mix(white, magenta, dist * 4.0) * accretionDisk;
        } else if (dist < 0.4) {
            color += mix(magenta, brightPurple, (dist - 0.25) * 6.67) * accretionDisk;
        } else {
            color += mix(brightPurple, deepPurple, (dist - 0.4) * 2.5) * accretionDisk;
        }
    }
    
    // ENHANCED: Add energy particles with bright colors
    color += particles * mix(electricBlue, brightPurple, 0.7) * 2.0;
    
    // ENHANCED: Add drain streams
    color += streams * brightPurple * 1.5;
    
    // ENHANCED: Add pulsing waves
    color += waves * mix(magenta, brightPurple, 0.5) * 1.2;
    
    // Energy jets
    color += brightPurple * jetEffect;
    
    // Hawking radiation
    color += deepPurple * hawkingGlow;
    
    // Event horizon - pure black with purple rim
    color *= eventHorizon;
    color += brightPurple * (1.0 - eventHorizon) * smoothstep(0.12, 0.18, dist) * 0.5;
    
    // ENHANCED: Extra intensity and dramatic glow
    color *= 1.5;
    color += color * color * 0.5; // Stronger self-glow
    
    // Add screen-space glow effect
    float screenGlow = exp(-dist * 3.0) * 0.2;
    color += brightPurple * screenGlow;
    
    gl_FragColor = vec4(color, 1.0);
}
            `
        });
    }

    onPreRender() {
        this.set1f('iTime', this.game.loop.time / 1000.0);
        // Increased resolution for larger, more detailed shader effect
        const symbolSize = 96; // Increased resolution for 1.5x larger size
        this.set3f('iResolution', symbolSize, symbolSize, 1.0);
    }
};

// Create the shader factory function
window.createThanosPowerGripShader = function(scene) {
    const shader = scene.game.renderer.addPipeline('ThanosPowerGrip', new window.ThanosPowerGripShader(scene.game));
    return shader;
};