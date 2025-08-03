const aws = require('aws-sdk');

/**
 * Handler for AWS Config Remediation Widget
 * Provides remediation actions for non-compliant Config rules
 */
exports.handler = async (event) => {
    try {
        const widgetContext = event.widgetContext || {};
        const params = event.params || {};
        
        // Handle different action types
        if (params.action === 'remediateRule') {
            return await handleRemediationAction(event, widgetContext);
        } else if (params.action === 'getRemediationStatus') {
            return await getRemediationStatus(event, widgetContext);
        } else if (params.action === 'showRuleDetails') {
            return await showRuleDetails(event, widgetContext);
        } else {
            return await getRemediationDashboard(event, widgetContext);
        }
        
    } catch (error) {
        console.error('Error in configRemediationWidget:', error);
        return generateErrorHTML(error, event.widgetContext);
    }
};

/**
 * Handle remediation action for a specific rule
 */
async function handleRemediationAction(event, widgetContext) {
    const params = event.params || {};
    const ruleName = params.ruleName;
    
    if (!ruleName) {
        return generateErrorHTML(new Error('Rule name is required for remediation'), widgetContext);
    }
    
    try {
        // Initialize AWS Config service
        const config = new aws.ConfigService({ 
            region: widgetContext.region || process.env.AWS_REGION 
        });
        
        // Get rule details to check if it has remediation configuration
        const ruleDetails = await config.describeConfigRules({
            ConfigRuleNames: [ruleName]
        }).promise();
        
        const rule = ruleDetails.ConfigRules[0];
        
        if (!rule) {
            return generateErrorHTML(new Error(`Rule ${ruleName} not found`), widgetContext);
        }
        
        // Check if rule has remediation configuration
        if (!rule.Source || !rule.Source.Owner || rule.Source.Owner !== 'AWS') {
            return generateRemediationNotAvailableHTML(ruleName, widgetContext);
        }
        
        // For AWS managed rules, we'll provide guidance on manual remediation
        return generateRemediationGuidanceHTML(rule, widgetContext);
        
    } catch (error) {
        console.error('Error handling remediation action:', error);
        return generateErrorHTML(error, widgetContext);
    }
}

/**
 * Show detailed information for a specific rule
 */
async function showRuleDetails(event, widgetContext) {
    const params = event.params || {};
    const ruleName = params.ruleName;
    
    if (!ruleName) {
        return generateErrorHTML(new Error('Rule name is required'), widgetContext);
    }
    
    try {
        const config = new aws.ConfigService({ 
            region: widgetContext.region || process.env.AWS_REGION 
        });
        
        // Get rule details and compliance information
        const [ruleDetails, complianceDetails] = await Promise.all([
            config.describeConfigRules({
                ConfigRuleNames: [ruleName]
            }).promise(),
            config.getComplianceDetailsByConfigRule({
                ConfigRuleName: ruleName,
                ComplianceTypes: ['NON_COMPLIANT', 'COMPLIANT', 'NOT_APPLICABLE'],
                Limit: 100
            }).promise()
        ]);
        
        const rule = ruleDetails.ConfigRules[0];
        if (!rule) {
            return generateErrorHTML(new Error(`Rule ${ruleName} not found`), widgetContext);
        }
        
        return generateRuleDetailsHTML(rule, complianceDetails.EvaluationResults || [], widgetContext);
        
    } catch (error) {
        console.error('Error showing rule details:', error);
        return generateErrorHTML(error, widgetContext);
    }
}

/**
 * Get remediation status for a rule
 */
async function getRemediationStatus(event, widgetContext) {
    const params = event.params || {};
    const ruleName = params.ruleName;
    
    try {
        const config = new aws.ConfigService({ 
            region: widgetContext.region || process.env.AWS_REGION 
        });
        
        // Get current compliance status
        const complianceDetails = await config.getComplianceDetailsByConfigRule({
            ConfigRuleName: ruleName,
            ComplianceTypes: ['NON_COMPLIANT'],
            Limit: 50
        }).promise();
        
        return generateRemediationStatusHTML(ruleName, complianceDetails.EvaluationResults || [], widgetContext);
        
    } catch (error) {
        console.error('Error getting remediation status:', error);
        return generateErrorHTML(error, widgetContext);
    }
}

/**
 * Get main remediation dashboard
 */
async function getRemediationDashboard(event, widgetContext) {
    try {
        const config = new aws.ConfigService({ 
            region: widgetContext.region || process.env.AWS_REGION 
        });
        
        // Get current account ID
        const sts = new aws.STS({ region: widgetContext.region || process.env.AWS_REGION });
        const accountInfo = await sts.getCallerIdentity().promise();
        const accountId = accountInfo.Account;
        
        // Get all non-compliant rules
        const [rulesResponse, complianceResponse] = await Promise.all([
            config.describeConfigRules().promise(),
            config.getComplianceSummaryByConfigRule().promise()
        ]);
        
        // For account-level rules, we need to get detailed compliance data
        const accountLevelRules = ['iam-password-policy', 'root-account-mfa-enabled', 'iam-user-mfa-enabled'];
        const detailedComplianceData = {};
        
        // Get detailed compliance for account-level rules
        for (const ruleName of accountLevelRules) {
            try {
                const ruleExists = rulesResponse.ConfigRules?.some(r => r.ConfigRuleName === ruleName);
                if (ruleExists) {
                    const details = await config.getComplianceDetailsByConfigRule({
                        ConfigRuleName: ruleName,
                        ComplianceTypes: ['NON_COMPLIANT', 'COMPLIANT', 'NOT_APPLICABLE'],
                        Limit: 100
                    }).promise();
                    
                    detailedComplianceData[ruleName] = details.EvaluationResults || [];
                }
            } catch (error) {
                console.log(`Error getting detailed compliance for ${ruleName}:`, error.message);
            }
        }
        
        // Filter for non-compliant rules
        const complianceMap = {};
        if (complianceResponse.ComplianceSummaryByConfigRule && Array.isArray(complianceResponse.ComplianceSummaryByConfigRule)) {
            complianceResponse.ComplianceSummaryByConfigRule.forEach(item => {
                complianceMap[item.ConfigRuleName] = {
                    CompliantResourceCount: item.ComplianceSummary.CompliantResourceCount || 0,
                    NonCompliantResourceCount: item.ComplianceSummary.NonCompliantResourceCount || 0,
                    TotalResourceCount: item.ComplianceSummary.TotalResourceCount || 0
                };
            });
        }
        
        // Handle account-level rules with detailed compliance data
        Object.keys(detailedComplianceData).forEach(ruleName => {
            const evaluationResults = detailedComplianceData[ruleName];
            const nonCompliantCount = evaluationResults.filter(r => r.ComplianceType === 'NON_COMPLIANT').length;
            const compliantCount = evaluationResults.filter(r => r.ComplianceType === 'COMPLIANT').length;
            const totalCount = evaluationResults.length;
            
            // For account-level rules, if we have evaluation results, use them
            if (totalCount > 0) {
                complianceMap[ruleName] = {
                    CompliantResourceCount: compliantCount,
                    NonCompliantResourceCount: nonCompliantCount,
                    TotalResourceCount: totalCount
                };
            }
        });
        
        const nonCompliantRules = (rulesResponse.ConfigRules || []).filter(rule => {
            const compliance = complianceMap[rule.ConfigRuleName];
            // Include rules that are non-compliant (including account-level rules)
            return compliance && compliance.NonCompliantResourceCount > 0;
        });
        
        return generateRemediationDashboardHTML(nonCompliantRules, complianceMap, widgetContext, accountId);
        
    } catch (error) {
        console.error('Error getting remediation dashboard:', error);
        return generateErrorHTML(error, widgetContext);
    }
}

/**
 * Generate HTML for remediation dashboard
 */
function generateRemediationDashboardHTML(rules, complianceMap, widgetContext, accountId = null) {
    const width = widgetContext.width || 400;
    const height = widgetContext.height || 300;
    const theme = widgetContext.theme || 'light';
    
    return `
        <style>
            .remediation-widget {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: ${theme === 'dark' ? '#e1e4e8' : '#24292e'};
                background: ${theme === 'dark' ? '#0d1117' : '#ffffff'};
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 6px;
                padding: 12px;
                overflow: hidden;
                box-sizing: border-box;
            }
            
            .widget-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
            }
            
            .widget-title {
                font-size: 14px;
                font-weight: 600;
                margin: 0;
            }
            
            .summary-stats {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
            }
            
            .stat-item {
                text-align: center;
                padding: 6px 8px;
                border-radius: 4px;
                background: ${theme === 'dark' ? '#5a1e1e' : '#ffebe9'};
                color: ${theme === 'dark' ? '#ff8182' : '#cf222e'};
                font-size: 10px;
                font-weight: 600;
            }
            
            .rules-list {
                height: calc(100% - 120px);
                overflow-y: auto;
                flex: 1;
            }
            
            .rule-item {
                padding: 8px;
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 4px;
                margin-bottom: 6px;
                background: ${theme === 'dark' ? '#161b22' : '#f6f8fa'};
            }
            
            .rule-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
            }
            
            .rule-name {
                font-weight: 600;
                font-size: 11px;
                color: ${theme === 'dark' ? '#58a6ff' : '#0969da'};
            }
            
            .non-compliant-count {
                background: ${theme === 'dark' ? '#5a1e1e' : '#ffebe9'};
                color: ${theme === 'dark' ? '#ff8182' : '#cf222e'};
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: 500;
            }
            
            .rule-description {
                font-size: 10px;
                color: ${theme === 'dark' ? '#8b949e' : '#656d76'};
                margin-bottom: 8px;
            }
            
            .remediation-actions {
                display: flex;
                gap: 6px;
            }
            
            .action-button {
                background: ${theme === 'dark' ? '#21262d' : '#f6f8fa'};
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 3px;
                padding: 4px 8px;
                font-size: 10px;
                cursor: pointer;
                color: ${theme === 'dark' ? '#e1e4e8' : '#24292e'};
                transition: all 0.2s ease;
            }
            
            .action-button:hover {
                background: ${theme === 'dark' ? '#30363d' : '#e1e4e8'};
                border-color: ${theme === 'dark' ? '#58a6ff' : '#0969da'};
            }
            
            .primary-action {
                background: ${theme === 'dark' ? '#0c2d6b' : '#dafbe1'};
                color: ${theme === 'dark' ? '#58a6ff' : '#1a7f37'};
                border-color: ${theme === 'dark' ? '#58a6ff' : '#1a7f37'};
            }
            
            .primary-action:hover {
                background: ${theme === 'dark' ? '#1a7f37' : '#1a7f37'};
                color: ${theme === 'dark' ? '#ffffff' : '#ffffff'};
            }
            
            .no-data {
                text-align: center;
                padding: 20px;
                color: ${theme === 'dark' ? '#8b949e' : '#656d76'};
                font-style: italic;
            }
        </style>
        
        <div class="remediation-widget" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div class="widget-header">
                <h3 class="widget-title">Remediation Dashboard</h3>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                    <span style="font-size: 10px; color: ${theme === 'dark' ? '#8b949e' : '#656d76'};">
                        ${rules.length} rules need attention
                    </span>
                    ${accountId ? `<span style="font-size: 9px; color: ${theme === 'dark' ? '#656d76' : '#8b949e'}; font-family: monospace;">Account: ${accountId}</span>` : ''}
                </div>
            </div>
            
            <div class="summary-stats">
                <div class="stat-item">
                    ${rules.length} Rules Need Attention
                </div>
            </div>
            
            <div class="rules-list">
                ${rules.length === 0 ? 
                    '<div class="no-data">No rules need attention at this time! 🎉</div>' :
                    rules.map(rule => generateRemediationRuleItemHTML(rule, complianceMap[rule.ConfigRuleName], theme, accountId)).join('')
                }
            </div>
        </div>
    `;
}

/**
 * Generate HTML for remediation rule items
 */
function generateRemediationRuleItemHTML(rule, compliance, theme, accountId = null) {
    const nonCompliantCount = compliance.NonCompliantResourceCount;
    const totalCount = compliance.TotalResourceCount;
    
    return `
        <div class="rule-item">
            <div class="rule-header">
                <span class="rule-name">${rule.ConfigRuleName}</span>
                <span class="non-compliant-count">${nonCompliantCount} non-compliant</span>
            </div>
            <div class="rule-description">
                ${rule.Description ? rule.Description.substring(0, 120) + (rule.Description.length > 120 ? '...' : '') : 'No description available'}
                ${accountId ? `<br><span style="font-size: 9px; color: ${theme === 'dark' ? '#656d76' : '#8b949e'}; font-family: monospace;">Account: ${accountId}</span>` : ''}
            </div>
            <div class="remediation-actions">
                <cwdb-action name="remediateRule" 
                            parameters='{"ruleName": "${rule.ConfigRuleName}"}'
                            class="action-button primary-action">
                    Remediate
                </cwdb-action>
                <cwdb-action name="getRemediationStatus" 
                            parameters='{"ruleName": "${rule.ConfigRuleName}"}'
                            class="action-button">
                    Check Status
                </cwdb-action>
                <cwdb-action name="showRuleDetails" 
                            parameters='{"ruleName": "${rule.ConfigRuleName}"}'
                            class="action-button">
                    View Details
                </cwdb-action>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for remediation guidance
 */
function generateRemediationGuidanceHTML(rule, widgetContext) {
    const theme = widgetContext.theme || 'light';
    const ruleName = rule.ConfigRuleName;
    
    // Common remediation guidance for AWS managed rules
    const remediationGuidance = getRemediationGuidance(ruleName);
    
    return `
        <style>
            .remediation-guidance {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: ${theme === 'dark' ? '#e1e4e8' : '#24292e'};
                background: ${theme === 'dark' ? '#0d1117' : '#ffffff'};
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 6px;
                padding: 12px;
            }
            
            .guidance-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
            }
            
            .guidance-title {
                font-size: 14px;
                font-weight: 600;
                margin: 0;
            }
            
            .back-button {
                font-size: 10px;
                color: ${theme === 'dark' ? '#58a6ff' : '#0969da'};
                cursor: pointer;
                text-decoration: underline;
            }
            
            .guidance-content {
                margin-bottom: 16px;
            }
            
            .guidance-step {
                margin-bottom: 8px;
                padding: 8px;
                background: ${theme === 'dark' ? '#161b22' : '#f6f8fa'};
                border-radius: 4px;
                border-left: 3px solid ${theme === 'dark' ? '#58a6ff' : '#0969da'};
            }
            
            .step-number {
                font-weight: 600;
                color: ${theme === 'dark' ? '#58a6ff' : '#0969da'};
                margin-bottom: 4px;
            }
            
            .step-description {
                font-size: 11px;
                color: ${theme === 'dark' ? '#e1e4e8' : '#24292e'};
            }
            
            .action-buttons {
                display: flex;
                gap: 8px;
                margin-top: 12px;
            }
            
            .action-button {
                background: ${theme === 'dark' ? '#21262d' : '#f6f8fa'};
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 3px;
                padding: 6px 12px;
                font-size: 11px;
                cursor: pointer;
                color: ${theme === 'dark' ? '#e1e4e8' : '#24292e'};
            }
            
            .primary-button {
                background: ${theme === 'dark' ? '#0c2d6b' : '#dafbe1'};
                color: ${theme === 'dark' ? '#58a6ff' : '#1a7f37'};
                border-color: ${theme === 'dark' ? '#58a6ff' : '#1a7f37'};
            }
        </style>
        
        <div class="remediation-guidance">
            <div class="guidance-header">
                <h3 class="guidance-title">Remediation: ${ruleName}</h3>
                <span class="back-button" onclick="window.parent.postMessage({
                    action: 'showRemediationDashboard'
                }, '*')">← Back to Dashboard</span>
            </div>
            
            <div class="guidance-content">
                ${remediationGuidance.steps.map((step, index) => `
                    <div class="guidance-step">
                        <div class="step-number">Step ${index + 1}</div>
                        <div class="step-description">${step}</div>
                    </div>
                `).join('')}
            </div>
            
            <div class="action-buttons">
                <cwdb-action name="getRemediationStatus" 
                            parameters='{"ruleName": "${ruleName}"}'
                            class="action-button primary-button">
                    Check Status
                </cwdb-action>
                <span class="action-button" onclick="window.parent.postMessage({
                    action: 'showRuleDetails',
                    ruleName: '${ruleName}'
                }, '*')">
                    View Rule Details
                </span>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for remediation not available
 */
function generateRemediationNotAvailableHTML(ruleName, widgetContext) {
    const theme = widgetContext.theme || 'light';
    
    return `
        <style>
            .remediation-not-available {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: ${theme === 'dark' ? '#e1e4e8' : '#24292e'};
                background: ${theme === 'dark' ? '#0d1117' : '#ffffff'};
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 6px;
                padding: 12px;
            }
            
            .not-available-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
            }
            
            .not-available-title {
                font-size: 14px;
                font-weight: 600;
                margin: 0;
            }
            
            .back-button {
                font-size: 10px;
                color: ${theme === 'dark' ? '#58a6ff' : '#0969da'};
                cursor: pointer;
                text-decoration: underline;
            }
            
            .not-available-content {
                background: ${theme === 'dark' ? '#3c2300' : '#fff8c5'};
                color: ${theme === 'dark' ? '#d29922' : '#9a6700'};
                padding: 12px;
                border-radius: 4px;
                border: 1px solid ${theme === 'dark' ? '#d29922' : '#9a6700'};
                margin-bottom: 12px;
            }
            
            .action-buttons {
                display: flex;
                gap: 8px;
            }
            
            .action-button {
                background: ${theme === 'dark' ? '#21262d' : '#f6f8fa'};
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 3px;
                padding: 6px 12px;
                font-size: 11px;
                cursor: pointer;
                color: ${theme === 'dark' ? '#e1e4e8' : '#24292e'};
            }
        </style>
        
        <div class="remediation-not-available">
            <div class="not-available-header">
                <h3 class="not-available-title">Remediation: ${ruleName}</h3>
                <span class="back-button" onclick="window.parent.postMessage({
                    action: 'showRemediationDashboard'
                }, '*')">← Back to Dashboard</span>
            </div>
            
            <div class="not-available-content">
                <strong>Manual Remediation Required</strong><br>
                This rule requires manual remediation. Automated remediation is not available for this rule type.
                Please review the rule documentation and manually fix the non-compliant resources.
            </div>
            
            <div class="action-buttons">
                <span class="action-button" onclick="window.parent.postMessage({
                    action: 'showRuleDetails',
                    ruleName: '${ruleName}'
                }, '*')">
                    View Rule Details
                </span>
                <span class="action-button" onclick="window.parent.postMessage({
                    action: 'showComplianceSummary'
                }, '*')">
                    Back to Summary
                </span>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for remediation status
 */
function generateRemediationStatusHTML(ruleName, evaluationResults, widgetContext) {
    const theme = widgetContext.theme || 'light';
    const nonCompliantCount = evaluationResults.length;
    
    return `
        <style>
            .remediation-status {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: ${theme === 'dark' ? '#e1e4e8' : '#24292e'};
                background: ${theme === 'dark' ? '#0d1117' : '#ffffff'};
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 6px;
                padding: 12px;
            }
            
            .status-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
            }
            
            .status-title {
                font-size: 14px;
                font-weight: 600;
                margin: 0;
            }
            
            .back-button {
                font-size: 10px;
                color: ${theme === 'dark' ? '#58a6ff' : '#0969da'};
                cursor: pointer;
                text-decoration: underline;
            }
            
            .status-summary {
                background: ${nonCompliantCount === 0 ? 
                    (theme === 'dark' ? '#0c2d6b' : '#dafbe1') : 
                    (theme === 'dark' ? '#5a1e1e' : '#ffebe9')
                };
                color: ${nonCompliantCount === 0 ? 
                    (theme === 'dark' ? '#58a6ff' : '#1a7f37') : 
                    (theme === 'dark' ? '#ff8182' : '#cf222e')
                };
                padding: 12px;
                border-radius: 4px;
                margin-bottom: 12px;
                text-align: center;
                font-weight: 600;
            }
            
            .resources-list {
                max-height: 200px;
                overflow-y: auto;
            }
            
            .resource-item {
                padding: 6px 8px;
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 3px;
                margin-bottom: 4px;
                background: ${theme === 'dark' ? '#161b22' : '#f6f8fa'};
                font-size: 11px;
            }
            
            .resource-id {
                font-weight: 600;
                color: ${theme === 'dark' ? '#58a6ff' : '#0969da'};
            }
            
            .resource-type {
                color: ${theme === 'dark' ? '#8b949e' : '#656d76'};
                font-size: 10px;
            }
            
            .no-data {
                text-align: center;
                padding: 20px;
                color: ${theme === 'dark' ? '#8b949e' : '#656d76'};
                font-style: italic;
            }
        </style>
        
        <div class="remediation-status">
            <div class="status-header">
                <h3 class="status-title">Status: ${ruleName}</h3>
                <span class="back-button" onclick="window.parent.postMessage({
                    action: 'showRemediationDashboard'
                }, '*')">← Back to Dashboard</span>
            </div>
            
            <div class="status-summary">
                ${nonCompliantCount === 0 ? 
                    '✅ All resources are now compliant!' :
                    `⚠️ ${nonCompliantCount} resources still need remediation`
                }
            </div>
            
            ${nonCompliantCount > 0 ? `
                <div class="resources-list">
                    ${evaluationResults.map(resource => {
                        const resourceId = resource.EvaluationResultIdentifier.EvaluationResultQualifier.ResourceId || 'Unknown';
                        const resourceType = resource.EvaluationResultIdentifier.EvaluationResultQualifier.ResourceType || 'Unknown';
                        return `
                            <div class="resource-item">
                                <div class="resource-id">${resourceId}</div>
                                <div class="resource-type">${resourceType}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Get remediation guidance for common AWS managed rules
 */
function getRemediationGuidance(ruleName) {
    const guidanceMap = {
        's3-bucket-public-read-prohibited': {
            steps: [
                'Remove public read access from the S3 bucket',
                'Update bucket policy to deny public read access',
                'Consider using bucket ACLs to restrict access',
                'Verify bucket is not used for public content hosting'
            ]
        },
        's3-bucket-public-write-prohibited': {
            steps: [
                'Remove public write access from the S3 bucket',
                'Update bucket policy to deny public write access',
                'Review bucket permissions and remove unnecessary public access',
                'Consider using IAM roles for controlled access'
            ]
        },
        'iam-password-policy': {
            steps: [
                'Configure IAM password policy in AWS Console',
                'Set minimum password length (recommended: 12 characters)',
                'Enable password complexity requirements',
                'Set password expiration and prevent reuse'
            ]
        },
        'rds-instance-public-access-check': {
            steps: [
                'Modify RDS instance to disable public access',
                'Update security groups to restrict access',
                'Use VPC endpoints for private connectivity',
                'Consider using RDS Proxy for connection management'
            ]
        },
        'vpc-sg-open-only-to-authorized-ports': {
            steps: [
                'Review security group rules and remove unnecessary open ports',
                'Restrict access to specific IP ranges where possible',
                'Use least privilege principle for port access',
                'Consider using security group references instead of 0.0.0.0/0'
            ]
        }
    };
    
    return guidanceMap[ruleName] || {
        steps: [
            'Review the AWS Config rule documentation',
            'Identify the specific compliance requirements',
            'Manually fix the non-compliant resources',
            'Re-run the Config rule evaluation to verify compliance'
        ]
    };
}

/**
 * Generate HTML for rule details view
 */
function generateRuleDetailsHTML(rule, evaluationResults, widgetContext) {
    const theme = widgetContext.theme || 'light';
    const ruleName = rule.ConfigRuleName;
    
    const nonCompliantCount = evaluationResults.filter(r => r.ComplianceType === 'NON_COMPLIANT').length;
    const compliantCount = evaluationResults.filter(r => r.ComplianceType === 'COMPLIANT').length;
    const totalCount = evaluationResults.length;
    
    return `
        <style>
            .rule-details-view {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: ${theme === 'dark' ? '#e1e4e8' : '#24292e'};
                background: ${theme === 'dark' ? '#0d1117' : '#ffffff'};
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 6px;
                padding: 12px;
            }
            
            .details-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
            }
            
            .details-title {
                font-size: 14px;
                font-weight: 600;
                margin: 0;
            }
            
            .back-button {
                font-size: 10px;
                color: ${theme === 'dark' ? '#58a6ff' : '#0969da'};
                cursor: pointer;
                text-decoration: underline;
            }
            
            .rule-info {
                margin-bottom: 16px;
            }
            
            .rule-description {
                font-size: 11px;
                color: ${theme === 'dark' ? '#8b949e' : '#656d76'};
                margin-bottom: 12px;
                line-height: 1.5;
            }
            
            .compliance-summary {
                display: flex;
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .compliance-stat {
                text-align: center;
                padding: 8px;
                border-radius: 4px;
                min-width: 60px;
            }
            
            .stat-compliant {
                background: ${theme === 'dark' ? '#0c2d6b' : '#dafbe1'};
                color: ${theme === 'dark' ? '#58a6ff' : '#1a7f37'};
            }
            
            .stat-noncompliant {
                background: ${theme === 'dark' ? '#5a1e1e' : '#ffebe9'};
                color: ${theme === 'dark' ? '#ff8182' : '#cf222e'};
            }
            
            .stat-total {
                background: ${theme === 'dark' ? '#21262d' : '#f6f8fa'};
                color: ${theme === 'dark' ? '#e1e4e8' : '#24292e'};
            }
            
            .stat-number {
                font-size: 16px;
                font-weight: 600;
                display: block;
            }
            
            .stat-label {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .resources-section {
                margin-bottom: 16px;
            }
            
            .section-title {
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 8px;
                color: ${theme === 'dark' ? '#e1e4e8' : '#24292e'};
            }
            
            .resources-list {
                max-height: 200px;
                overflow-y: auto;
            }
            
            .resource-item {
                padding: 6px 8px;
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 3px;
                margin-bottom: 4px;
                background: ${theme === 'dark' ? '#161b22' : '#f6f8fa'};
                font-size: 11px;
            }
            
            .resource-id {
                font-weight: 600;
                color: ${theme === 'dark' ? '#58a6ff' : '#0969da'};
            }
            
            .resource-type {
                color: ${theme === 'dark' ? '#8b949e' : '#656d76'};
                font-size: 10px;
            }
            
            .resource-compliance {
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 3px;
                font-weight: 500;
                margin-left: 8px;
            }
            
            .compliance-compliant {
                background: ${theme === 'dark' ? '#0c2d6b' : '#dafbe1'};
                color: ${theme === 'dark' ? '#58a6ff' : '#1a7f37'};
            }
            
            .compliance-noncompliant {
                background: ${theme === 'dark' ? '#5a1e1e' : '#ffebe9'};
                color: ${theme === 'dark' ? '#ff8182' : '#cf222e'};
            }
            
            .no-resources {
                text-align: center;
                padding: 20px;
                color: ${theme === 'dark' ? '#8b949e' : '#656d76'};
                font-style: italic;
            }
            
            .action-buttons {
                display: flex;
                gap: 8px;
                margin-top: 12px;
            }
            
            .action-button {
                background: ${theme === 'dark' ? '#21262d' : '#f6f8fa'};
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 3px;
                padding: 6px 12px;
                font-size: 11px;
                cursor: pointer;
                color: ${theme === 'dark' ? '#e1e4e8' : '#24292e'};
            }
            
            .primary-button {
                background: ${theme === 'dark' ? '#0c2d6b' : '#dafbe1'};
                color: ${theme === 'dark' ? '#58a6ff' : '#1a7f37'};
                border-color: ${theme === 'dark' ? '#58a6ff' : '#1a7f37'};
            }
        </style>
        
        <div class="rule-details-view">
            <div class="details-header">
                <h3 class="details-title">Rule Details: ${ruleName}</h3>
                <span class="back-button" onclick="window.parent.postMessage({
                    action: 'showRemediationDashboard'
                }, '*')">← Back to Dashboard</span>
            </div>
            
            <div class="rule-info">
                <div class="rule-description">
                    ${rule.Description || 'No description available'}
                </div>
                
                <div class="compliance-summary">
                    <div class="compliance-stat stat-compliant">
                        <span class="stat-number">${compliantCount}</span>
                        <span class="stat-label">Compliant</span>
                    </div>
                    <div class="compliance-stat stat-noncompliant">
                        <span class="stat-number">${nonCompliantCount}</span>
                        <span class="stat-label">Non-Compliant</span>
                    </div>
                    <div class="compliance-stat stat-total">
                        <span class="stat-number">${totalCount}</span>
                        <span class="stat-label">Total</span>
                    </div>
                </div>
            </div>
            
            ${totalCount > 0 ? `
                <div class="resources-section">
                    <div class="section-title">Affected Resources</div>
                    <div class="resources-list">
                        ${evaluationResults.map(resource => {
                            const resourceId = resource.EvaluationResultIdentifier.EvaluationResultQualifier.ResourceId || 'Unknown';
                            const resourceType = resource.EvaluationResultIdentifier.EvaluationResultQualifier.ResourceType || 'Unknown';
                            const complianceType = resource.ComplianceType;
                            const complianceClass = complianceType === 'COMPLIANT' ? 'compliance-compliant' : 'compliance-noncompliant';
                            const complianceText = complianceType === 'COMPLIANT' ? 'Compliant' : 'Non-Compliant';
                            
                            return `
                                <div class="resource-item">
                                    <div class="resource-id">${resourceId}</div>
                                    <div class="resource-type">${resourceType}</div>
                                    <span class="resource-compliance ${complianceClass}">${complianceText}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : `
                <div class="resources-section">
                    <div class="section-title">Affected Resources</div>
                    <div class="no-resources">No resources evaluated for this rule</div>
                </div>
            `}
            
            <div class="action-buttons">
                <cwdb-action name="remediateRule" 
                            parameters='{"ruleName": "${ruleName}"}'
                            class="action-button primary-button">
                    Remediate
                </cwdb-action>
                <cwdb-action name="getRemediationStatus" 
                            parameters='{"ruleName": "${ruleName}"}'
                            class="action-button">
                    Check Status
                </cwdb-action>
            </div>
        </div>
    `;
}

/**
 * Generate error HTML
 */
function generateErrorHTML(error, widgetContext) {
    const theme = widgetContext?.theme || 'light';
    
    return `
        <style>
            .error-container {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 16px;
                border-radius: 6px;
                background: ${theme === 'dark' ? '#0d1117' : '#ffffff'};
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
            }
            
            .error {
                color: ${theme === 'dark' ? '#ff8182' : '#cf222e'};
                background: ${theme === 'dark' ? '#5a1e1e' : '#ffebe9'};
                padding: 12px;
                border-radius: 4px;
                border: 1px solid ${theme === 'dark' ? '#ff8182' : '#cf222e'};
                margin-bottom: 8px;
            }
            
            .error-title {
                font-weight: 600;
                margin-bottom: 4px;
            }
            
            .error-message {
                font-size: 12px;
                line-height: 1.4;
            }
        </style>
        
        <div class="error-container">
            <div class="error">
                <div class="error-title">Remediation Widget Error</div>
                <div class="error-message">${error.message || 'An unknown error occurred while processing remediation action.'}</div>
            </div>
            <div style="font-size: 11px; color: ${theme === 'dark' ? '#8b949e' : '#656d76'};">
                Check CloudWatch logs for more details.
            </div>
        </div>
    `;
} 