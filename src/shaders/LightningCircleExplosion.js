window.LightningCircleExplosionShader = {
    fragmentShader: `
        precision mediump float;
        
        // Compatibility uniforms from existing Phaser pipeline
        uniform float time;
        uniform vec2 resolution;
        uniform float scale; // visual scale (>1 enlarges effect)

        // Map to Shadertoy-style uniforms expected by the sample
        #define iResolution vec3(resolution, 1.0)
        #define iTime time
        uniform vec2 center; // screen-space center in pixels
        uniform vec2 centerOffsetNorm; // normalized (relative to screen height), matches BlackholeShader setCenterOffset

        // --- BEGIN exact sample GLSL (unmodified) ---
        vec3 hsb2rgb(in vec3 c)
        {
            vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),
                                     6.0)-3.0)-1.0,
                             0.0,
                             1.0 );
            rgb = rgb*rgb*(3.0-2.0*rgb);
            return c.z * mix( vec3(1.0), rgb, c.y);
        }

        void mainImage( out vec4 fragColor, in vec2 fragCoord )
        {   
            vec2 p = (2.0*fragCoord.xy-iResolution.xy)/iResolution.y;
            
            float r = length(p) * 0.9;
            // Adjusted to purple hue
            vec3 color = hsb2rgb(vec3(0.78, 0.75, 0.8));
            
            float a = pow(r, 2.0);
            float b = sin(r * 0.8 - 1.6);
            float c = sin(r - 0.010);
            float s = sin(a - iTime * 3.0 + b) * c;
            
            color *= abs(1.0 / (s * 10.8)) - 0.01;
            fragColor = vec4(color, 1.);
        }
        // --- END exact sample GLSL ---

        // Minimal wrapper to call sample's mainImage
        void main() {
            vec2 desiredCenter = center;
            // Apply normalized offset (relative to height). Positive y moves content up.
            desiredCenter += vec2(centerOffsetNorm.x * iResolution.y, -centerOffsetNorm.y * iResolution.y);
            // Shift coordinates so the sample's assumed center (iResolution.xy*0.5) maps to desiredCenter
            vec2 delta = iResolution.xy * 0.5 - desiredCenter;
            vec2 targetFrag = gl_FragCoord.xy + delta;
            // Scale around desiredCenter so scale>1 makes visuals larger
            vec2 fromCenter = targetFrag - desiredCenter;
            vec2 adjustedFrag = desiredCenter + (fromCenter / max(scale, 0.0001));
            vec4 fragColor;
            mainImage(fragColor, adjustedFrag);
            gl_FragColor = fragColor;
        }
    `
};

// Phaser 3 pipeline wrapper for the LightningCircleExplosion shader
// Provides time/resolution uniforms and a factory for reuse
window.LightningCircleExplosion = class LightningCircleExplosion extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(game) {
        super({
            game: game,
            renderer: game.renderer,
            fragShader: window.LightningCircleExplosionShader.fragmentShader
        });
        this.key = 'LightningCircleExplosion';
    }

    onBind(gameObject) {
        super.onBind(gameObject);
        const renderer = this.game.renderer;
        const nowSeconds = (this.game.loop && this.game.loop.time ? this.game.loop.time : performance.now()) / 1000;
        this.set1f('time', nowSeconds);
        this.set2f('resolution', renderer.width, renderer.height);
        // Center in screen pixels - use the game object's world position if available
        let cx = renderer.width * 0.5;
        let cy = renderer.height * 0.5;
        if (gameObject && typeof gameObject.getWorldTransformMatrix === 'function') {
            const m = gameObject.getWorldTransformMatrix();
            cx = m.tx;
            cy = m.ty;
        } else if (gameObject && typeof gameObject.getCenter === 'function') {
            const pt = gameObject.getCenter();
            cx = pt.x;
            cy = pt.y;
        } else if (gameObject && gameObject.x !== undefined && gameObject.y !== undefined) {
            cx = gameObject.x;
            cy = gameObject.y;
        }
        this.set2f('center', cx, cy);
        // Match BlackholeShader's internal center offset (relative to height)
        // Values chosen to align visually with black hole FX
        this.set2f('centerOffsetNorm', 0.09, 0.12);

        // Heuristic: enlarge to 8x when game object indicates Burst mode or uses burst_thunder asset
        let burstScale = 1.0;
        try {
            const texKey = (gameObject && gameObject.texture && gameObject.texture.key) || (gameObject && gameObject.frame && gameObject.frame.texture && gameObject.frame.texture.key) || '';
            const keyIsBurstThunder = typeof texKey === 'string' && texKey.toLowerCase().indexOf('burst_thunder') !== -1;
            const isBurst = !!(
                gameObject && (
                    (gameObject.data && typeof gameObject.data.get === 'function' && (gameObject.data.get('mode') === 'Burst' || gameObject.data.get('fxMode') === 'Burst')) ||
                    gameObject.mode === 'Burst' ||
                    gameObject.name === 'Burst' ||
                    keyIsBurstThunder
                )
            );
            burstScale = isBurst ? 8.0 : 1.0;
        } catch (_) {
            burstScale = 1.0;
        }
        this.set1f('scale', burstScale);
    }
};

window.createLightningCircleExplosionShader = function(scene) {
    try {
        const mgr = scene.game.renderer.pipelines || scene.game.renderer;
        if (mgr.get && mgr.get('LightningCircleExplosion')) {
            return mgr.get('LightningCircleExplosion');
        }
        const shader = new window.LightningCircleExplosion(scene.game);
        if (scene.game.renderer.pipelines) {
            scene.game.renderer.pipelines.add('LightningCircleExplosion', shader);
        } else {
            scene.game.renderer.addPipeline('LightningCircleExplosion', shader);
        }
        return shader;
    } catch (error) {
        console.error('Failed to create LightningCircleExplosion shader:', error);
        throw error;
    }
};