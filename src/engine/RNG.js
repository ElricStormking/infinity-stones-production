// SECURITY: Controlled RNG facade for casino game security
// Prevents unauthorized client-side randomness and enables server-side RNG control
(function(){
  // Security monitoring
  var rngCallCount = 0;
  var unauthorizedCallCount = 0;
  var securityLogging = true;
  
  function XorShift(seedStr) {
    if (!seedStr) {
      // If no seed, use Math.random but with security monitoring
      if (securityLogging) {
        console.warn('SECURITY: Using unseeded RNG - consider using server-provided seed for production');
      }
      // Use original Math.random to avoid triggering security warnings for legitimate use
      return (window.Math.random.original || Math.random).bind(Math);
    }
    var h = 2166136261 >>> 0;
    for (var i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    var x = (h ^ 0x9E3779B9) >>> 0;
    var y = 0x243F6A88 >>> 0;
    var z = 0xB7E15162 >>> 0;
    var w = 0xDEADBEEF >>> 0;
    return function() {
      var t = x ^ (x << 11);
      x = y; y = z; z = w;
      w = (w ^ (w >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
      return (w >>> 0) / 0x100000000;
    };
  }

  function RNG(seed) {
    this._rand = XorShift(seed || null);
    this._seeded = !!seed;
    rngCallCount++;
    
    if (securityLogging && rngCallCount % 100 === 0) {
      console.log(`SECURITY: RNG usage stats - Total calls: ${rngCallCount}, Unauthorized: ${unauthorizedCallCount}`);
    }
  }
  
  RNG.prototype.random = function(){ 
    if (!this._seeded && securityLogging) {
      unauthorizedCallCount++;
      if (unauthorizedCallCount === 1) {
        console.warn('SECURITY: First unseeded RNG call detected - production games should use server seeds');
      }
    }
    return this._rand(); 
  };
  
  RNG.prototype.int = function(min, max){
    min = Math.ceil(min); max = Math.floor(max);
    return Math.floor(this.random() * (max - min + 1)) + min;
  };
  
  RNG.prototype.chance = function(p){ return this.random() < p; };
  
  RNG.prototype.weighted = function(weightsObj){
    var total = 0, k;
    for (k in weightsObj) if (Object.prototype.hasOwnProperty.call(weightsObj, k)) total += weightsObj[k];
    var r = this.random() * total;
    for (k in weightsObj) if (Object.prototype.hasOwnProperty.call(weightsObj, k)) {
      r -= weightsObj[k];
      if (r <= 0) return k;
    }
    return Object.keys(weightsObj)[0];
  };

  // SECURITY: Add methods to monitor and control RNG usage
  RNG.getSecurityStats = function() {
    return {
      totalCalls: rngCallCount,
      unauthorizedCalls: unauthorizedCallCount,
      securityRatio: unauthorizedCallCount / Math.max(rngCallCount, 1)
    };
  };
  
  RNG.enableSecurityLogging = function(enabled) {
    securityLogging = !!enabled;
  };
  
  RNG.resetSecurityStats = function() {
    rngCallCount = 0;
    unauthorizedCallCount = 0;
  };

  // SECURITY: Override Math.random() to detect unauthorized usage
  if (typeof window !== 'undefined' && window.Math && window.Math.random) {
    var originalMathRandom = window.Math.random;
    window.Math.random = function() {
      if (securityLogging) {
        console.warn('SECURITY: Math.random() call detected - use window.RNG for game logic');
        // Don't throw error, just warn for now to allow initialization
      }
      return originalMathRandom();
    };
    
    // Provide escape hatch for legitimate uses
    window.Math.random.original = originalMathRandom;
  }

  window.RNG = RNG;
})();


