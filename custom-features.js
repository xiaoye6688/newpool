/**
 * 自定义Augment扩展功能模块
 * 专门用于管理 accessToken 和 tenantURL
 */

const vscode = require('vscode');
const crypto = require('crypto');

class AugmentCustomFeatures {
    constructor() {
        this.logger = this.createLogger();
        this.isInitialized = false;
    }

    createLogger() {
        return {
            info: (msg, ...args) => console.log(`[AugmentCustom] ${msg}`, ...args),
            warn: (msg, ...args) => console.warn(`[AugmentCustom] ${msg}`, ...args),
            error: (msg, ...args) => console.error(`[AugmentCustom] ${msg}`, ...args),
            debug: (msg, ...args) => console.debug(`[AugmentCustom] ${msg}`, ...args)
        };
    }

    /**
     * 初始化自定义功能
     */
    async initialize(context, augmentExtension = null) {
        if (this.isInitialized) {
            this.logger.warn('Custom features already initialized');
            return;
        }

        try {
            this.context = context;
            this.augmentExtension = augmentExtension;

            // 注册自定义命令
            this.registerCommands();

            this.isInitialized = true;
            this.logger.info('Custom features initialized successfully');

        } catch (error) {
            this.logger.error('Failed to initialize custom features:', error);
            throw error;
        }
    }

    /**
     * 注册自定义命令
     */
    registerCommands() {
        const commands = [
            {
                id: 'augment.custom.newpool',
                handler: () => this.handleNewPool()
            }
        ];

        commands.forEach(cmd => {
            const disposable = vscode.commands.registerCommand(cmd.id, cmd.handler);
            this.context.subscriptions.push(disposable);
        });

        this.logger.info(`Registered ${commands.length} custom commands`);
    }

    /**
     * 获取 accessToken
     */
    async getAccessToken() {
        try {
            const currentValue = await this.context.secrets.get('augment.sessions');
            if (currentValue) {
                try {
                    const sessionsData = JSON.parse(currentValue);
                    return {
                        success: true,
                        accessToken: sessionsData.accessToken,
                        tenantURL: sessionsData.tenantURL,
                        data: sessionsData
                    };
                } catch (error) {
                    this.logger.error('Failed to parse sessions data:', error);
                    return {
                        success: false,
                        error: '解析会话数据失败'
                    };
                }
            } else {
                return {
                    success: false,
                    error: '未找到会话数据'
                };
            }
        } catch (error) {
            this.logger.error('Failed to get access token:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 设置secret
     */
    async setSecret(key, value) {
        try {
            const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
            await this.context.secrets.store(key, valueStr);
            this.logger.info(`Secret ${key} stored successfully`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to store secret ${key}:`, error);
            return false;
        }
    }

    /**
     * 更新 augment.sessions 中的 accessToken
     */
    async updateAccessToken(newAccessToken) {
        try {
            // 获取当前的 sessions 数据
            const currentValue = await this.context.secrets.get('augment.sessions');
            let sessionsData = {};

            if (currentValue) {
                try {
                    sessionsData = JSON.parse(currentValue);
                } catch (error) {
                    this.logger.warn('Failed to parse existing sessions data, creating new object');
                    sessionsData = {};
                }
            }

            // 更新 accessToken，保留其他字段
            sessionsData.accessToken = newAccessToken;

            // 如果没有其他必要字段，设置默认值
            if (!sessionsData.tenantURL) {
                sessionsData.tenantURL = "https://d5.api.augmentcode.com/";
            }
            if (!sessionsData.scopes) {
                sessionsData.scopes = ["email"];
            }

            // 保存更新后的数据
            const success = await this.setSecret('augment.sessions', sessionsData);

            if (success) {
                this.logger.info(`AccessToken updated successfully`);
                return {
                    success: true,
                    data: sessionsData
                };
            } else {
                return {
                    success: false,
                    error: '存储更新后的会话数据失败'
                };
            }
        } catch (error) {
            this.logger.error('Failed to update access token:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 更新 tenantURL 和 accessToken
     */
    async updateSessionsData(tenantURL, accessToken) {
        try {
            // 获取当前的 sessions 数据
            const currentValue = await this.context.secrets.get('augment.sessions');
            let sessionsData = {};

            if (currentValue) {
                try {
                    sessionsData = JSON.parse(currentValue);
                } catch (error) {
                    this.logger.warn('Failed to parse existing sessions data, creating new object');
                    sessionsData = {};
                }
            }

            // 更新数据
            sessionsData.tenantURL = tenantURL;
            sessionsData.accessToken = accessToken;

            // 如果没有其他必要字段，设置默认值
            if (!sessionsData.scopes) {
                sessionsData.scopes = ["email"];
            }

            // 保存更新后的数据
            const success = await this.setSecret('augment.sessions', sessionsData);

            if (success) {
                this.logger.info(`Sessions data updated successfully`);
                return {
                    success: true,
                    data: sessionsData
                };
            } else {
                return {
                    success: false,
                    error: '存储更新后的会话数据失败'
                };
            }
        } catch (error) {
            this.logger.error('Failed to update sessions data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 命令处理器
    async handleNewPool() {
        try {
            // 显示主菜单选项
            const action = await vscode.window.showQuickPick([
                {
                    label: '获取 accessToken',
                    description: '查看当前的 accessToken 和 tenantURL',
                    detail: '显示当前存储的认证信息，支持复制和查看完整数据'
                },
                {
                    label: '设置 accessToken',
                    description: '修改 accessToken 或 tenantURL',
                    detail: '更新认证信息，支持仅更新 accessToken 或完整更新会话数据'
                },
                {
                    label: '更新机器码',
                    description: '重置设备唯一标识符',
                    detail: '生成并更新当前设备的机器码标识'
                }
            ], {
                placeHolder: '选择要执行的操作'
            });

            if (!action) return;

            // 根据选择执行对应的操作
            if (action.label === '获取 accessToken') {
                await this.handleGetAccessToken();
            } else if (action.label === '设置 accessToken') {
                await this.handleSetToken();
            } else if (action.label === '更新机器码') {
                await this.handleUpdateMachineCode();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`错误: ${error.message}`);
        }
    }


    // 获取 accessToken
    async handleGetAccessToken() {
        try {
            const result = await this.getAccessToken();

            if (result.success) {
                const tokenDisplay = result.accessToken && result.accessToken.length > 16
                    ? `${result.accessToken.substring(0, 8)}...${result.accessToken.substring(result.accessToken.length - 8)}`
                    : result.accessToken || '未设置';

                const message = `accessToken: ${tokenDisplay}\ntenantURL: ${result.tenantURL || '未设置'}`;

                const action = await vscode.window.showInformationMessage(
                    message,
                    '复制 accessToken',
                    '显示完整数据'
                );

                if (action === '复制 accessToken' && result.accessToken) {
                    await vscode.env.clipboard.writeText(result.accessToken);
                    vscode.window.showInformationMessage('accessToken 已复制到剪贴板');
                } else if (action === '显示完整数据') {
                    const doc = await vscode.workspace.openTextDocument({
                        content: JSON.stringify(result.data, null, 2),
                        language: 'json'
                    });
                    await vscode.window.showTextDocument(doc);
                }
            } else {
                vscode.window.showErrorMessage(`获取 accessToken 失败: ${result.error}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`错误: ${error.message}`);
        }
    }

    // 设置 accessToken
    async handleSetToken() {
        try {
            // 提供选项：更新 accessToken 或设置其他 secret
            const action = await vscode.window.showQuickPick([
                {
                    label: '仅更新 accessToken',
                    description: '只更新 augment.sessions 中的 accessToken',
                    detail: '快速更新：仅修改 accessToken，保留 tenantURL 和权限范围'
                },
                {
                    label: '更新会话数据',
                    description: '更新 augment.sessions 中的 tenantURL 和 accessToken',
                    detail: '完整更新：通过引导输入同时修改 tenantURL 和 accessToken'
                }
            ], {
                placeHolder: '选择要更新的内容'
            });

            if (!action) return;

            if (action.label === '仅更新 accessToken') {
                // 获取当前的 accessToken 作为 placeholder
                let currentAccessToken = '输入新的 accessToken...';
                try {
                    const currentValue = await this.context.secrets.get('augment.sessions');
                    if (currentValue) {
                        const sessionsData = JSON.parse(currentValue);
                        if (sessionsData.accessToken) {
                            // 显示当前 token 的前8位和后8位，中间用...代替
                            const token = sessionsData.accessToken;
                            if (token.length > 16) {
                                currentAccessToken = `当前: ${token.substring(0, 8)}...${token.substring(token.length - 8)}`;
                            } else {
                                currentAccessToken = `当前: ${token}`;
                            }
                        }
                    }
                } catch (error) {
                    this.logger.debug('Failed to get current accessToken for placeholder:', error);
                }

                // 专门处理 accessToken 更新
                const newAccessToken = await vscode.window.showInputBox({
                    prompt: '输入新的 accessToken',
                    placeHolder: currentAccessToken,
                    password: true,
                    validateInput: (value) => {
                        if (!value || value.trim().length === 0) {
                            return 'accessToken 不能为空';
                        }
                        if (value.length < 10) {
                            return 'accessToken 长度似乎太短';
                        }
                        return null;
                    }
                });

                if (!newAccessToken) return;

                const result = await this.updateAccessToken(newAccessToken.trim());
                if (result.success) {
                    vscode.window.showInformationMessage(`accessToken 更新成功！`);

                    // 显示更新后的完整数据
                    const showData = await vscode.window.showInformationMessage(
                        'accessToken 更新成功！',
                        '显示更新后的数据'
                    );

                    if (showData === '显示更新后的数据') {
                        const doc = await vscode.workspace.openTextDocument({
                            content: JSON.stringify(result.data, null, 2),
                            language: 'json'
                        });
                        await vscode.window.showTextDocument(doc);
                    }
                } else {
                    vscode.window.showErrorMessage(`更新 accessToken 失败: ${result.error}`);
                }
            } else {
                // 修改 tenantURL 和 accessToken

                // 获取当前的 sessions 数据作为默认值
                let currentData = {
                    accessToken: '',
                    tenantURL: 'https://d5.api.augmentcode.com/',
                    scopes: ['email']
                };

                try {
                    const currentValue = await this.context.secrets.get('augment.sessions');
                    if (currentValue) {
                        const sessionsData = JSON.parse(currentValue);
                        currentData = { ...currentData, ...sessionsData };
                    }
                } catch (error) {
                    this.logger.debug('Failed to get current sessions data:', error);
                }

                // 第一步：输入 tenantURL
                const newTenantURL = await vscode.window.showInputBox({
                    prompt: '输入 tenantURL',
                    placeHolder: `当前: ${currentData.tenantURL}`,
                    value: currentData.tenantURL,
                    validateInput: (value) => {
                        if (!value || value.trim().length === 0) {
                            return 'tenantURL 不能为空';
                        }
                        try {
                            new URL(value);
                            return null;
                        } catch {
                            return '请输入有效的URL (例如: https://d5.api.augmentcode.com/)';
                        }
                    }
                });

                if (!newTenantURL) return;

                // 第二步：输入 accessToken
                const currentTokenDisplay = currentData.accessToken.length > 16
                    ? `${currentData.accessToken.substring(0, 8)}...${currentData.accessToken.substring(currentData.accessToken.length - 8)}`
                    : currentData.accessToken;

                const newAccessToken = await vscode.window.showInputBox({
                    prompt: '输入 accessToken',
                    placeHolder: `当前: ${currentTokenDisplay}`,
                    password: true,
                    validateInput: (value) => {
                        if (!value || value.trim().length === 0) {
                            return 'accessToken 不能为空';
                        }
                        if (value.length < 10) {
                            return 'accessToken 长度似乎太短';
                        }
                        return null;
                    }
                });

                if (!newAccessToken) return;

                // 更新数据
                const updatedData = {
                    ...currentData,
                    tenantURL: newTenantURL.trim(),
                    accessToken: newAccessToken.trim()
                };

                // 保存更新后的数据
                const success = await this.setSecret('augment.sessions', updatedData);
                if (success) {
                    vscode.window.showInformationMessage('会话数据更新成功！');

                    // 显示更新后的数据
                    const showData = await vscode.window.showInformationMessage(
                        '会话数据更新成功！',
                        '显示更新后的数据'
                    );

                    if (showData === '显示更新后的数据') {
                        const doc = await vscode.workspace.openTextDocument({
                            content: JSON.stringify(updatedData, null, 2),
                            language: 'json'
                        });
                        await vscode.window.showTextDocument(doc);
                    }
                } else {
                    vscode.window.showErrorMessage('更新会话数据失败');
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`错误: ${error.message}`);
        }
    }


    // 更新机器码
    async handleUpdateMachineCode() {
        try {
            // 使用uuid生成新的sessionId
            const newSessionId = crypto.randomUUID();

            // 直接更新sessionId
            await this.context.globalState.update('sessionId', newSessionId);

            // 显示成功消息
            vscode.window.showInformationMessage(
                `sessionId更新成功！新值: ${newSessionId}，请重载窗口以生效`,
                '重载窗口'
            ).then(selection => {
                // 如果用户点击"重载窗口"或2秒后自动重载
                if (selection === '重载窗口') {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`错误: ${error.message}`);
        }
    }

    /**
     * 清理资源
     */
    dispose() {
        this.isInitialized = false;
        this.logger.info('Custom features disposed');
    }
}

module.exports = AugmentCustomFeatures;
