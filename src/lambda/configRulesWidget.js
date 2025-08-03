const aws = require('aws-sdk');

/**
 * Main handler for AWS Config Rules Widget
 * Fetches Config rules data and returns styled HTML for CloudWatch Custom Widget
 */
exports.handler = async (event) => {
    try {
        const widgetContext = event.widgetContext || {};
        const params = event.params || {};
        const timeRange = widgetContext.timeRange || {};
        
        // Initialize AWS Config service
        const config = new aws.ConfigService({ 
            region: params.region || widgetContext.region || process.env.AWS_REGION 
        });
        
        // Get current account ID
        const sts = new aws.STS({ region: params.region || widgetContext.region || process.env.AWS_REGION });
        const accountInfo = await sts.getCallerIdentity().promise();
        const accountId = accountInfo.Account;
        
        // Fetch Config rules and compliance data
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
        
        // Process and filter data based on parameters
        const processedData = processConfigData(rulesResponse, complianceResponse, params, detailedComplianceData, accountId);
        
        // Generate HTML response styled for CloudWatch
        return generateConfigWidgetHTML(processedData, widgetContext, params);
        
    } catch (error) {
        console.error('Error in configRulesWidget:', error);
        return generateErrorHTML(error, event.widgetContext);
    }
};

/**
 * Process Config rules and compliance data
 */
function processConfigData(rulesResponse, complianceResponse, params, detailedComplianceData = {}, accountId = null) {
    const rules = rulesResponse.ConfigRules || [];
    const compliance = complianceResponse.ComplianceSummaryByConfigRule || [];
    
    // Create compliance lookup map
    const complianceMap = {};
    compliance.forEach(item => {
        complianceMap[item.ConfigRuleName] = {
            CompliantResourceCount: item.ComplianceSummary.CompliantResourceCount || 0,
            NonCompliantResourceCount: item.ComplianceSummary.NonCompliantResourceCount || 0,
            TotalResourceCount: item.ComplianceSummary.TotalResourceCount || 0
        };
    });
    
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
    
    // Filter rules based on parameters
    let filteredRules = rules;
    
    if (params.ruleNames && params.ruleNames.length > 0) {
        filteredRules = rules.filter(rule => params.ruleNames.includes(rule.ConfigRuleName));
    }
    
    if (params.complianceStatus) {
        filteredRules = filteredRules.filter(rule => {
            const compliance = complianceMap[rule.ConfigRuleName];
            if (!compliance) return false;
            
            if (params.complianceStatus === 'COMPLIANT') {
                return compliance.NonCompliantResourceCount === 0 && compliance.TotalResourceCount > 0;
            } else if (params.complianceStatus === 'NON_COMPLIANT') {
                return compliance.NonCompliantResourceCount > 0;
            } else if (params.complianceStatus === 'INSUFFICIENT_DATA') {
                return compliance.TotalResourceCount === 0;
            }
            return true;
        });
    }
    
    if (params.resourceTypes && params.resourceTypes.length > 0) {
        filteredRules = filteredRules.filter(rule => {
            const scope = rule.Scope;
            if (!scope || !scope.ComplianceResourceTypes) return false;
            return scope.ComplianceResourceTypes.some(type => params.resourceTypes.includes(type));
        });
    }
    
    // Add compliance data to rules
    const processedRules = filteredRules.map(rule => ({
        ...rule,
        compliance: complianceMap[rule.ConfigRuleName] || {
            CompliantResourceCount: 0,
            NonCompliantResourceCount: 0,
            TotalResourceCount: 0
        }
    }));
    
    return {
        rules: processedRules,
        summary: {
            total: processedRules.length,
            compliant: processedRules.filter(rule => 
                rule.compliance.NonCompliantResourceCount === 0 && rule.compliance.TotalResourceCount > 0
            ).length,
            nonCompliant: processedRules.filter(rule => 
                rule.compliance.NonCompliantResourceCount > 0
            ).length,
            insufficientData: processedRules.filter(rule => 
                rule.compliance.TotalResourceCount === 0
            ).length
        },
        accountId: accountId
    };
}

/**
 * Generate HTML for the Config Rules Widget
 */
function generateConfigWidgetHTML(data, widgetContext, params) {
    const width = widgetContext.width || 400;
    const height = widgetContext.height || 300;
    const theme = widgetContext.theme || 'light';
    
    const { rules, summary, accountId } = data;
    
    return `
        <style>
            .config-widget {
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
                gap: 12px;
                margin-bottom: 12px;
            }
            
            .stat-item {
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
            
            .stat-insufficient {
                background: ${theme === 'dark' ? '#3c2300' : '#fff8c5'};
                color: ${theme === 'dark' ? '#d29922' : '#9a6700'};
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
                transition: all 0.2s ease;
            }
            
            .rule-item:hover {
                border-color: ${theme === 'dark' ? '#58a6ff' : '#0969da'};
                background: ${theme === 'dark' ? '#1c2128' : '#f0f6fc'};
            }
            
            .rule-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }
            
            .rule-name {
                font-weight: 600;
                font-size: 11px;
                color: ${theme === 'dark' ? '#58a6ff' : '#0969da'};
                cursor: pointer;
            }
            
            .rule-status {
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 3px;
                font-weight: 500;
            }
            
            .status-compliant {
                background: ${theme === 'dark' ? '#0c2d6b' : '#dafbe1'};
                color: ${theme === 'dark' ? '#58a6ff' : '#1a7f37'};
            }
            
            .status-noncompliant {
                background: ${theme === 'dark' ? '#5a1e1e' : '#ffebe9'};
                color: ${theme === 'dark' ? '#ff8182' : '#cf222e'};
            }
            
            .status-insufficient {
                background: ${theme === 'dark' ? '#3c2300' : '#fff8c5'};
                color: ${theme === 'dark' ? '#d29922' : '#9a6700'};
            }
            
            .rule-details {
                font-size: 10px;
                color: ${theme === 'dark' ? '#8b949e' : '#656d76'};
            }
            
            .compliance-chart {
                margin: 8px 0;
            }
            
            .no-data {
                text-align: center;
                padding: 20px;
                color: ${theme === 'dark' ? '#8b949e' : '#656d76'};
                font-style: italic;
            }
            
            .error {
                color: ${theme === 'dark' ? '#ff8182' : '#cf222e'};
                background: ${theme === 'dark' ? '#5a1e1e' : '#ffebe9'};
                padding: 8px;
                border-radius: 4px;
                border: 1px solid ${theme === 'dark' ? '#ff8182' : '#cf222e'};
            }
        </style>
        
        <div class="config-widget" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div class="widget-header">
                <h3 class="widget-title">AWS Config Rules Status</h3>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                    <span style="font-size: 10px; color: ${theme === 'dark' ? '#8b949e' : '#656d76'};">
                        ${summary.total} rules
                    </span>
                    ${accountId ? `<span style="font-size: 9px; color: ${theme === 'dark' ? '#656d76' : '#8b949e'}; font-family: monospace;">Account: ${accountId}</span>` : ''}
                </div>
            </div>
            
            <div class="summary-stats">
                <div class="stat-item stat-compliant">
                    <span class="stat-number">${summary.compliant}</span>
                    <span class="stat-label">Compliant</span>
                </div>
                <div class="stat-item stat-noncompliant">
                    <span class="stat-number">${summary.nonCompliant}</span>
                    <span class="stat-label">Non-Compliant</span>
                </div>
                <div class="stat-item stat-insufficient">
                    <span class="stat-number">${summary.insufficientData}</span>
                    <span class="stat-label">Insufficient Data</span>
                </div>
            </div>
            
                         <div class="rules-list">
                 ${rules.length === 0 ? 
                     '<div class="no-data">No Config rules found matching the current filters.</div>' :
                     rules.map(rule => generateRuleItemHTML(rule, theme, params, accountId)).join('')
                 }
             </div>
        </div>
    `;
}

/**
 * Generate HTML for individual rule items
 */
function generateRuleItemHTML(rule, theme, params = {}, accountId = null) {
    const compliance = rule.compliance;
    // For account-level rules, if they have non-compliant resources, they should be considered non-compliant
    // even if TotalResourceCount is 0 (this handles cases like iam-password-policy)
    const isCompliant = compliance.NonCompliantResourceCount === 0 && compliance.TotalResourceCount > 0;
    const isNonCompliant = compliance.NonCompliantResourceCount > 0;
    const isInsufficient = compliance.TotalResourceCount === 0 && compliance.NonCompliantResourceCount === 0;
    
    let statusClass = 'status-insufficient';
    let statusText = 'Insufficient Data';
    
    if (isCompliant) {
        statusClass = 'status-compliant';
        statusText = 'Compliant';
    } else if (isNonCompliant) {
        statusClass = 'status-noncompliant';
        statusText = 'Non-Compliant';
    }
    
    const compliancePercentage = compliance.TotalResourceCount > 0 ? 
        Math.round((compliance.CompliantResourceCount / compliance.TotalResourceCount) * 100) : 0;
    
    return `
        <div class="rule-item">
            <div class="rule-header">
                <span class="rule-name" onclick="window.parent.postMessage({
                    action: 'showRuleDetails',
                    ruleName: '${rule.ConfigRuleName}'
                }, '*')">${rule.ConfigRuleName}</span>
                <span class="rule-status ${statusClass}">${statusText}</span>
            </div>
            <div class="rule-details">
                ${compliance.TotalResourceCount > 0 ? 
                    `${compliance.CompliantResourceCount}/${compliance.TotalResourceCount} resources compliant (${compliancePercentage}%)` :
                    compliance.NonCompliantResourceCount > 0 ?
                        `Account (${compliance.NonCompliantResourceCount} non-compliant)` :
                        'No resources evaluated'
                }
                ${rule.Description ? `<br>${rule.Description.substring(0, 100)}${rule.Description.length > 100 ? '...' : ''}` : ''}
                ${accountId ? `<br><span style="font-size: 9px; color: ${theme === 'dark' ? '#656d76' : '#8b949e'}; font-family: monospace;">Account: ${accountId}</span>` : ''}
            </div>
            ${isNonCompliant && params.showRemediation !== false ? `
                <div style="margin-top: 6px;">
                    <cwdb-action name="remediateRule" 
                                parameters='{"ruleName": "${rule.ConfigRuleName}"}'
                                style="background: ${theme === 'dark' ? '#21262d' : '#f6f8fa'}; 
                                       border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'}; 
                                       border-radius: 3px; 
                                       padding: 4px 8px; 
                                       font-size: 10px; 
                                       cursor: pointer;">
                        Remediate
                    </cwdb-action>
                </div>
            ` : ''}
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
                <div class="error-title">AWS Config Widget Error</div>
                <div class="error-message">${error.message || 'An unknown error occurred while fetching Config rules data.'}</div>
            </div>
            <div style="font-size: 11px; color: ${theme === 'dark' ? '#8b949e' : '#656d76'};">
                Check CloudWatch logs for more details.
            </div>
        </div>
    `;
} 