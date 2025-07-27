// 引入自定义功能模块
const AugmentCustomFeatures = require('./custom-features');

// 全局变量存储自定义功能实例
let customFeatures = null;

// 保存原始的exports
const originalExports = typeof module !== 'undefined' && module.exports ? { ...module.exports } : {};

// 定义自定义的activate函数
async function customActivate(context) {
    // 如果存在原始的activate函数，先调用它
    if (originalExports.activate && typeof originalExports.activate === 'function') {
        try {
            await originalExports.activate(context);
        } catch (error) {
            console.error('[AugmentCustom] 原始激活函数执行失败:', error);
        }
    }

    // 初始化自定义功能
    try {
        customFeatures = new AugmentCustomFeatures();
        await customFeatures.initialize(context);
        console.log('[AugmentCustom] 自定义功能激活成功');
    } catch (error) {
        console.error('[AugmentCustom] 激活自定义功能失败:', error);
    }
}

// 定义自定义的deactivate函数
function customDeactivate() {
    // 清理自定义功能
    if (customFeatures) {
        customFeatures.dispose();
        customFeatures = null;
    }

    // 如果存在原始的deactivate函数，调用它
    if (originalExports.deactivate && typeof originalExports.deactivate === 'function') {
        try {
            originalExports.deactivate();
        } catch (error) {
            console.error('[AugmentCustom] 原始deactivate函数执行失败:', error);
        }
    }
}

// 导出新的activate和deactivate函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ...originalExports,
        activate: customActivate,
        deactivate: customDeactivate
    };
} else if (typeof exports !== 'undefined') {
    exports.activate = customActivate;
    exports.deactivate = customDeactivate;
}
