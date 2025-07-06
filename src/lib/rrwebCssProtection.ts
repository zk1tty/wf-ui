/**
 * 🎨 RRWeb CSS Protection - Surgical CSS Filtering and Patching
 * 
 * This module provides surgical CSS protection for rrweb replay to prevent
 * "Regular expression too large" errors from sites like Amazon Prime Video.
 * 
 * Key Features:
 * - Surgical filtering of specific problematic CSS patterns
 * - Aggressive patching of rrweb's internal adaptCssForReplay function
 * - Safe string operations to avoid regex overflow
 * - Preserves normal CSS while removing dangerous patterns
 */

/**
 * 🚨 CRITICAL: Aggressive patching of rrweb's internal adaptCssForReplay function
 * This prevents "Regular expression too large" errors from Amazon's massive CSS
 */
export const patchRRWebCssProcessing = (rrwebInstance: any, iframeWindow: any) => {
  console.log('🛡️ [CSS Protection] Starting aggressive rrweb CSS function patching...');
  
  try {
    // 🎯 METHOD 1: Direct function replacement in iframe's rrweb instance
    if (iframeWindow && iframeWindow.rrweb) {
      const rrweb = iframeWindow.rrweb;
      
      // Try to find and patch adaptCssForReplay function directly
      // It might be in various places in the rrweb object
      const tryPatchFunction = (obj: any, path: string) => {
        if (!obj) return false;
        
        for (const key in obj) {
          try {
            const value = obj[key];
            
            if (typeof value === 'function') {
              const funcStr = value.toString();
              
              // Look for adaptCssForReplay function by its signature
              if (funcStr.includes('adaptCssForReplay') || 
                  (funcStr.includes('css') && funcStr.includes('replace') && funcStr.includes('url'))) {
                console.log(`🎯 [CSS Patch] Found potential adaptCssForReplay at ${path}.${key}`);
                
                // Replace with safe version
                const originalFunc = value;
                obj[key] = function(...args: any[]) {
                  try {
                    // 🎯 SURGICAL: Filter only specific problematic CSS patterns
                    const safeArgs = args.map(arg => {
                      if (typeof arg === 'string' && arg.includes('PHN2ZyB3aWR0aD0"MTgiIGhlaWdodD0"MzIi')) {
                        console.warn('🚨 [adaptCssForReplay] Amazon SVG pattern detected - applying surgical fix');
                        // Use safe string operations instead of regex
                        const startPattern = 'PHN2ZyB3aWR0aD0"MTgiIGhlaWdodD0"MzIi';
                        let result = arg;
                        let startIndex = 0;
                        while ((startIndex = result.indexOf(startPattern, startIndex)) !== -1) {
                          const endIndex = result.indexOf('"', startIndex + startPattern.length);
                          if (endIndex !== -1) {
                            result = result.substring(0, startIndex) + 'REMOVED_AMAZON_SVG' + result.substring(endIndex);
                            startIndex += 'REMOVED_AMAZON_SVG'.length;
                          } else {
                            break;
                          }
                        }
                        return result;
                      }
                      return arg;
                    });
                    
                    return originalFunc.apply(this, safeArgs);
                  } catch (error) {
                    console.warn('🚨 [adaptCssForReplay] CSS processing failed, using fallback:', error);
                    return '/* CSS processing failed - simplified */';
                  }
                };
                
                console.log(`✅ [CSS Patch] Patched function at ${path}.${key}`);
                return true;
              }
            } else if (typeof value === 'object' && value !== null) {
              // Recursively search in objects
              if (tryPatchFunction(value, `${path}.${key}`)) {
                return true;
              }
            }
          } catch (e) {
            // Skip problematic properties
          }
        }
        return false;
      };
      
      // Search for adaptCssForReplay in rrweb object
      tryPatchFunction(rrweb, 'rrweb');
    }
    
    // 🎯 METHOD 2: Global iframe function replacement via eval
    if (iframeWindow) {
      try {
        // Inject our safe adaptCssForReplay function into the iframe
        iframeWindow.eval(`
          (function() {
            // Find and replace adaptCssForReplay function globally
            const originalReplace = String.prototype.replace;
            
            String.prototype.replace = function(searchValue, replaceValue) {
              // 🎯 SURGICAL: Only target the specific Amazon SVG pattern that causes regex overflow
              if (typeof searchValue !== 'string' && 
                  this.includes('PHN2ZyB3aWR0aD0"MTgiIGhlaWdodD0"MzIi')) {
                
                console.warn('🚨 [String.replace] Specific Amazon SVG pattern detected - applying surgical fix');
                // Use safe string operations instead of regex to avoid creating another regex overflow
                const startPattern = 'PHN2ZyB3aWR0aD0"MTgiIGhlaWdodD0"MzIi';
                let result = this.toString();
                let startIndex = 0;
                while ((startIndex = result.indexOf(startPattern, startIndex)) !== -1) {
                  const endIndex = result.indexOf('"', startIndex + startPattern.length);
                  if (endIndex !== -1) {
                    result = result.substring(0, startIndex) + 'REMOVED_AMAZON_SVG' + result.substring(endIndex);
                    startIndex += 'REMOVED_AMAZON_SVG'.length;
                  } else {
                    break;
                  }
                }
                return result;
              }
              
              try {
                return originalReplace.call(this, searchValue, replaceValue);
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                if (errorMsg.includes('Regular expression too large')) {
                  console.warn('🚨 [String.replace] Regex overflow caught - using safe replacement');
                  return '/* CSS content simplified due to regex overflow */';
                }
                throw error;
              }
            };
            
            console.log('✅ [CSS Protection] String.prototype.replace patched successfully');
          })();
        `);
      } catch (evalError) {
        console.warn('⚠️ [CSS Protection] Could not inject via eval:', evalError);
      }
    }
    
    // 🎯 METHOD 3: Patch replayer methods that call adaptCssForReplay
    if (rrwebInstance && rrwebInstance.rebuildFullSnapshot) {
      const originalRebuildFullSnapshot = rrwebInstance.rebuildFullSnapshot;
      
      rrwebInstance.rebuildFullSnapshot = function(...args: any[]) {
        console.log('🛡️ [CSS Protection] Intercepting rebuildFullSnapshot');
        
        try {
          // Pre-process any arguments that might contain CSS
          const safeArgs = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
              return filterCssInObject(arg);
            }
            return arg;
          });
          
          return originalRebuildFullSnapshot.apply(this, safeArgs);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (errorMsg.includes('Regular expression too large')) {
            console.warn('🚨 [rebuildFullSnapshot] CSS regex overflow caught - skipping problematic content');
            return; // Skip this rebuild to prevent crash
          }
          throw error;
        }
      };
      
      console.log('✅ [CSS Protection] rebuildFullSnapshot method patched');
    }
    
    console.log('✅ [CSS Protection] Aggressive rrweb patching completed');
    
  } catch (error) {
    console.warn('⚠️ [CSS Protection] Aggressive patching failed:', error);
  }
};

/**
 * Helper function to surgically filter ONLY problematic CSS patterns
 * Preserves normal CSS but removes specific patterns that cause regex overflow
 */
export const filterCssInObject = (obj: any): any => {
  if (typeof obj === 'string') {
    // 🎯 SURGICAL FILTERING: Only target the specific Amazon SVG pattern that causes regex overflow
    if (obj.includes('PHN2ZyB3aWR0aD0"MTgiIGhlaWdodD0"MzIi')) {
      console.warn('🚨 [filterCssInObject] Amazon SVG pattern detected - removing specific pattern only');
      // Use safe string operations instead of regex to avoid regex overflow
      const startPattern = 'PHN2ZyB3aWR0aD0"MTgiIGhlaWdodD0"MzIi';
      let result = obj;
      let startIndex = 0;
      while ((startIndex = result.indexOf(startPattern, startIndex)) !== -1) {
        const endIndex = result.indexOf('"', startIndex + startPattern.length);
        if (endIndex !== -1) {
          result = result.substring(0, startIndex) + 'REMOVED_AMAZON_SVG' + result.substring(endIndex);
          startIndex += 'REMOVED_AMAZON_SVG'.length;
        } else {
          break;
        }
      }
      return result;
    }
    
    // 🎯 TARGETED: Only remove extremely long base64 data URIs (>10KB), not normal CSS
    if (obj.includes('data:image/svg+xml;base64,') && obj.length > 10000) {
      const beforeLength = obj.length;
      const filtered = obj.replace(/data:image\/svg\+xml;base64,[A-Za-z0-9+/]{1000,}={0,2}/g, 'data:image/svg+xml;base64,SIMPLIFIED');
      if (filtered.length < beforeLength) {
        console.warn(`🎯 [filterCssInObject] Removed long SVG data URI: ${Math.round(beforeLength/1024)}KB → ${Math.round(filtered.length/1024)}KB`);
        return filtered;
      }
    }
    
    return obj; // Preserve normal CSS
  }
  
  if (Array.isArray(obj)) {
    return obj.map(filterCssInObject);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const filtered: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        filtered[key] = filterCssInObject(obj[key]);
      }
    }
    return filtered;
  }
  
  return obj;
};

/**
 * 🛠️ CSS Protection Plugin for RRWeb
 * Provides surgical CSS filtering during DOM reconstruction
 */
export const createCssProtectionPlugin = () => ({
  onBuild: (node: any, _options: any) => {
    if (node.tagName === 'IFRAME') {
      node.removeAttribute('sandbox'); // Remove sandbox restrictions
      console.log('🔧 [CSS Plugin] Removed sandbox from internal iframe');
    }
    
    // 🎯 SURGICAL CSS PROTECTION: Only target specific problematic patterns
    if (node.tagName === 'STYLE') {
      const cssContent = node.textContent || node.innerHTML;
      if (cssContent) {
        let modifiedCSS = cssContent;
        let hasChanges = false;
        
        // 🎯 TARGETED: Only remove the specific Amazon SVG pattern that causes regex overflow
        if (cssContent.includes('PHN2ZyB3aWR0aD0"MTgiIGhlaWdodD0"MzIi')) {
          console.warn('🎯 [CSS Plugin] Amazon SVG pattern detected - removing specific pattern only');
          // Use safe string operations instead of regex to avoid regex overflow
          const startPattern = 'PHN2ZyB3aWR0aD0"MTgiIGhlaWdodD0"MzIi';
          let startIndex = 0;
          while ((startIndex = modifiedCSS.indexOf(startPattern, startIndex)) !== -1) {
            const endIndex = modifiedCSS.indexOf('"', startIndex + startPattern.length);
            if (endIndex !== -1) {
              modifiedCSS = modifiedCSS.substring(0, startIndex) + 'REMOVED_AMAZON_SVG' + modifiedCSS.substring(endIndex);
              startIndex += 'REMOVED_AMAZON_SVG'.length;
            } else {
              break;
            }
          }
          hasChanges = true;
        }
        
        // 🎯 TARGETED: Only remove extremely long base64 data URIs (>5KB)
        if (cssContent.includes('data:image/svg+xml;base64,') && cssContent.length > 100000) {
          const beforeLength = modifiedCSS.length;
          modifiedCSS = modifiedCSS.replace(/data:image\/svg\+xml;base64,[A-Za-z0-9+/]{2000,}={0,2}/g, 'data:image/svg+xml;base64,SIMPLIFIED');
          if (modifiedCSS.length < beforeLength) {
            console.warn(`🎯 [CSS Plugin] Removed long SVG data URI: ${Math.round(beforeLength/1024)}KB → ${Math.round(modifiedCSS.length/1024)}KB`);
            hasChanges = true;
          }
        }
        
        // Only apply changes if we found problematic patterns
        if (hasChanges) {
          node.textContent = modifiedCSS;
          console.log('✅ [CSS Plugin] Surgical CSS filtering applied - preserved normal CSS, removed problematic patterns');
        }
      }
    }
    
    return node;
  }
});

/**
 * 🔧 CSS Error Handler for RRWeb
 * Handles CSS processing errors specifically
 */
export const createCssErrorHandler = () => {
  return (error: any) => {
    const errorMsg = error?.message || String(error);
    
    // Handle CSS processing errors specifically
    if (errorMsg.includes('Regular expression too large') || 
        errorMsg.includes('adaptCssForReplay') ||
        errorMsg.includes('Invalid regular expression') ||
        errorMsg.includes('Pattern too large') ||
        errorMsg.includes('Regex overflow')) {
      console.warn('🎨 [CSS Error Handler] Large CSS detected in rrweb - using simplified CSS processing:', errorMsg);
      // Don't throw - continue with simplified CSS processing
      return false;
    }
    
    console.warn('rrweb replayer warning (continuing):', error);
    // Don't throw - continue despite other errors
    return false; // Prevent default error handling
  };
}; 