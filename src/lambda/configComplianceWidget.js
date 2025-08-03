const aws = require('aws-sdk');

/**
 * Handler for AWS Config Compliance Details Widget
 * Provides detailed compliance information with resource drilling capabilities
 */
exports.handler = async (event) => {
    try {
        const widgetContext = event.widgetContext || {};
        const params = event.params || {};
        
        // Initialize AWS Config service
        const config = new aws.ConfigService({ 
            region: params.region || widgetContext.region || process.env.AWS_REGION 
        });
        
        // Get detailed compliance data
        const complianceData = await getDetailedComplianceData(config, params);
        
        // Generate HTML response
        return generateComplianceWidgetHTML(complianceData, widgetContext, params);
        
    } catch (error) {
        console.error('Error in configComplianceWidget:', error);
        return generateErrorHTML(error, event.widgetContext);
    }
};

/**
 * Fetch detailed compliance data for specific rules or all rules
 */
async function getDetailedComplianceData(config, params) {
    const ruleName = params.ruleName;
    
    if (ruleName) {
        // Get detailed compliance for specific rule - include all compliance types
        const complianceDetails = await config.getComplianceDetailsByConfigRule({
            ConfigRuleName: ruleName,
            ComplianceTypes: ['NON_COMPLIANT', 'COMPLIANT', 'NOT_APPLICABLE'],
            Limit: 100
        }).promise();
        
        return {
            ruleName: ruleName,
            complianceDetails: complianceDetails.EvaluationResults || [],
            type: 'rule-details'
        };
    } else {
        // Get current account ID
        const sts = new aws.STS({ region: config.config.region });
        const accountInfo = await sts.getCallerIdentity().promise();
        const accountId = accountInfo.Account;
        
        // Get compliance summary for all rules
        const [rulesResponse, complianceResponse] = await Promise.all([
            config.describeConfigRules().promise(),
            config.getComplianceSummaryByConfigRule().promise()
        ]);
        
        // Debug logging to understand the API response
        console.log('Compliance Response:', JSON.stringify(complianceResponse, null, 2));
        console.log('Rules Response:', JSON.stringify(rulesResponse.ConfigRules?.map(r => r.ConfigRuleName), null, 2));
        
        // For account-level rules, we need to get detailed compliance data
        const accountLevelRules = ['iam-password-policy', 'root-account-mfa-enabled', 'iam-user-mfa-enabled'];
        const detailedComplianceData = {};
        
        // Debug: Check what rules we actually have
        console.log('Available rules:', rulesResponse.ConfigRules?.map(r => r.ConfigRuleName));
        
        // Get detailed compliance for account-level rules
        for (const ruleName of accountLevelRules) {
            try {
                const ruleExists = rulesResponse.ConfigRules?.some(r => r.ConfigRuleName === ruleName);
                console.log(`Checking if ${ruleName} exists:`, ruleExists);
                
                if (ruleExists) {
                    console.log(`Getting detailed compliance for account-level rule: ${ruleName}`);
                    const details = await config.getComplianceDetailsByConfigRule({
                        ConfigRuleName: ruleName,
                        ComplianceTypes: ['NON_COMPLIANT', 'COMPLIANT', 'NOT_APPLICABLE'],
                        Limit: 100
                    }).promise();
                    
                    detailedComplianceData[ruleName] = details.EvaluationResults || [];
                    console.log(`${ruleName} detailed compliance:`, JSON.stringify(details.EvaluationResults, null, 2));
                } else {
                    // Try to get compliance details anyway, in case the rule exists but wasn't returned by describeConfigRules
                    console.log(`Rule ${ruleName} not found in describeConfigRules, trying getComplianceDetailsByConfigRule anyway`);
                    try {
                        const details = await config.getComplianceDetailsByConfigRule({
                            ConfigRuleName: ruleName,
                            ComplianceTypes: ['NON_COMPLIANT', 'COMPLIANT', 'NOT_APPLICABLE'],
                            Limit: 100
                        }).promise();
                        
                        if (details.EvaluationResults && details.EvaluationResults.length > 0) {
                            detailedComplianceData[ruleName] = details.EvaluationResults || [];
                            console.log(`${ruleName} detailed compliance (found via direct call):`, JSON.stringify(details.EvaluationResults, null, 2));
                        }
                    } catch (directError) {
                        console.log(`Direct call for ${ruleName} failed:`, directError.message);
                    }
                }
            } catch (error) {
                console.log(`Error getting detailed compliance for ${ruleName}:`, error.message);
            }
        }
        
        return {
            rules: rulesResponse.ConfigRules || [],
            compliance: complianceResponse.ComplianceSummaryByConfigRule || [],
            detailedCompliance: detailedComplianceData,
            accountId: accountId,
            type: 'compliance-summary'
        };
    }
}

/**
 * Generate HTML for the Compliance Details Widget
 */
function generateComplianceWidgetHTML(data, widgetContext, params) {
    const width = widgetContext.width || 400;
    const height = widgetContext.height || 300;
    const theme = widgetContext.theme || 'light';
    
    if (data.type === 'rule-details') {
        return generateRuleDetailsHTML(data, widgetContext, params);
    } else {
        return generateComplianceSummaryHTML(data, widgetContext, params);
    }
}

/**
 * Generate HTML for rule-specific compliance details
 */
function generateRuleDetailsHTML(data, widgetContext, params) {
    const width = widgetContext.width || 400;
    const height = widgetContext.height || 300;
    const theme = widgetContext.theme || 'light';
    
    const { ruleName, complianceDetails } = data;
    
    // Group resources by compliance status
    const compliantResources = complianceDetails.filter(r => r.ComplianceType === 'COMPLIANT');
    const nonCompliantResources = complianceDetails.filter(r => r.ComplianceType === 'NON_COMPLIANT');
    const insufficientDataResources = complianceDetails.filter(r => r.ComplianceType === 'INSUFFICIENT_DATA');
    
    // Generate SVG pie chart for compliance distribution
    const totalResources = complianceDetails.length;
    const compliantPercentage = totalResources > 0 ? (compliantResources.length / totalResources) * 100 : 0;
    const nonCompliantPercentage = totalResources > 0 ? (nonCompliantResources.length / totalResources) * 100 : 0;
    const insufficientDataPercentage = totalResources > 0 ? (insufficientDataResources.length / totalResources) * 100 : 0;
    
    const svgChart = generateOverallComplianceChart(compliantResources.length, nonCompliantResources.length, insufficientDataResources.length, theme);
    
    return `
        <style>
            .compliance-widget {
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
            
            .back-button {
                font-size: 10px;
                color: ${theme === 'dark' ? '#58a6ff' : '#0969da'};
                cursor: pointer;
                text-decoration: underline;
            }
            
            .compliance-overview {
                display: flex;
                gap: 16px;
                margin-bottom: 16px;
            }
            
            .chart-container {
                flex: 0 0 120px;
            }
            
            .stats-container {
                flex: 1;
            }
            
            .stat-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
                padding: 4px 8px;
                border-radius: 3px;
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
            
            .resources-list {
                height: calc(100% - 200px);
                overflow-y: auto;
                flex: 1;
            }
            
            .resource-item {
                padding: 6px 8px;
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 3px;
                margin-bottom: 4px;
                background: ${theme === 'dark' ? '#161b22' : '#f6f8fa'};
                font-size: 11px;
            }
            
            .resource-compliant {
                border-left: 3px solid ${theme === 'dark' ? '#58a6ff' : '#1a7f37'};
            }
            
            .resource-noncompliant {
                border-left: 3px solid ${theme === 'dark' ? '#ff8182' : '#cf222e'};
            }
            
            .resource-insufficient {
                border-left: 3px solid ${theme === 'dark' ? '#d29922' : '#9a6700'};
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
        
        <div class="compliance-widget" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div class="widget-header">
                <h3 class="widget-title">Rule: ${ruleName}</h3>
                <span class="back-button" onclick="window.parent.postMessage({
                    action: 'showComplianceSummary'
                }, '*')">← Back to Summary</span>
            </div>
            
            <div class="compliance-overview">
                <div class="chart-container">
                    ${svgChart}
                </div>
                <div class="stats-container">
                    <div class="stat-row stat-compliant">
                        <span>Compliant Resources:</span>
                        <span>${compliantResources.length}</span>
                    </div>
                    <div class="stat-row stat-noncompliant">
                        <span>Non-Compliant Resources:</span>
                        <span>${nonCompliantResources.length}</span>
                    </div>
                    <div class="stat-row stat-insufficient">
                        <span>Insufficient Data:</span>
                        <span>${insufficientDataResources.length}</span>
                    </div>
                    <div style="margin-top: 8px; font-size: 10px; color: ${theme === 'dark' ? '#8b949e' : '#656d76'};">
                        Total: ${totalResources} resources
                    </div>
                </div>
            </div>
            
            <div class="resources-list">
                ${complianceDetails.length === 0 ? 
                    (nonCompliantResources.length > 0 || insufficientDataResources.length > 0 ? 
                        '<div class="no-data">Account-level rule - no specific resources to display</div>' :
                        '<div class="no-data">No compliance data available for this rule.</div>'
                    ) :
                    complianceDetails.map(resource => generateResourceItemHTML(resource, theme)).join('')
                }
            </div>
        </div>
    `;
}

/**
 * Generate HTML for compliance summary view
 */
function generateComplianceSummaryHTML(data, widgetContext, params) {
    const width = widgetContext.width || 400;
    const height = widgetContext.height || 300;
    const theme = widgetContext.theme || 'light';
    
    const { rules, compliance, detailedCompliance, accountId } = data;
    
    // Process compliance data
    const complianceMap = {};
    compliance.forEach(item => {
        complianceMap[item.ConfigRuleName] = {
            CompliantResourceCount: item.ComplianceSummary.CompliantResourceCount || 0,
            NonCompliantResourceCount: item.ComplianceSummary.NonCompliantResourceCount || 0,
            TotalResourceCount: item.ComplianceSummary.TotalResourceCount || 0
        };
        
        // Debug logging for specific rule
        if (item.ConfigRuleName === 'iam-password-policy') {
            console.log('iam-password-policy compliance data:', JSON.stringify(item, null, 2));
        }
    });
    
    // Handle account-level rules with detailed compliance data
    if (detailedCompliance) {
        Object.keys(detailedCompliance).forEach(ruleName => {
            const evaluationResults = detailedCompliance[ruleName];
            const nonCompliantCount = evaluationResults.filter(r => r.ComplianceType === 'NON_COMPLIANT').length;
            const compliantCount = evaluationResults.filter(r => r.ComplianceType === 'COMPLIANT').length;
            const notApplicableCount = evaluationResults.filter(r => r.ComplianceType === 'NOT_APPLICABLE').length;
            const totalCount = evaluationResults.length;
            
            // For account-level rules, if we have evaluation results, use them
            if (totalCount > 0) {
                complianceMap[ruleName] = {
                    CompliantResourceCount: compliantCount,
                    NonCompliantResourceCount: nonCompliantCount,
                    TotalResourceCount: totalCount
                };
                console.log(`Updated ${ruleName} with detailed compliance:`, complianceMap[ruleName]);
                console.log(`  - Non-compliant: ${nonCompliantCount}, Compliant: ${compliantCount}, Not Applicable: ${notApplicableCount}`);
            }
        });
    }
    
    // Debug: Check if iam-password-policy exists in rules but not in compliance
    const iamPasswordPolicyRule = rules.find(rule => rule.ConfigRuleName === 'iam-password-policy');
    if (iamPasswordPolicyRule && !complianceMap['iam-password-policy']) {
        console.log('WARNING: iam-password-policy rule exists in rules but not in compliance data');
        console.log('Rule data:', JSON.stringify(iamPasswordPolicyRule, null, 2));
        // Add a default entry for this rule
        complianceMap['iam-password-policy'] = {
            CompliantResourceCount: 0,
            NonCompliantResourceCount: 0,
            TotalResourceCount: 0
        };
    }
    
    // Calculate overall statistics
    const totalRules = rules.length;
    const compliantRules = rules.filter(rule => {
        const comp = complianceMap[rule.ConfigRuleName];
        // For account-level rules, check if they have any non-compliant resources
        return comp && comp.NonCompliantResourceCount === 0 && comp.TotalResourceCount > 0;
    }).length;
    
    const nonCompliantRules = rules.filter(rule => {
        const comp = complianceMap[rule.ConfigRuleName];
        // Include rules with any non-compliant resources
        // For account-level rules, if they exist in compliance data but have 0 total resources,
        // they might still be non-compliant (this handles the iam-password-policy case)
        return comp && comp.NonCompliantResourceCount > 0;
    }).length;
    
    const insufficientDataRules = totalRules - compliantRules - nonCompliantRules;
    
    // Debug logging for statistics
    console.log('Compliance Statistics:', {
        totalRules,
        compliantRules,
        nonCompliantRules,
        insufficientDataRules,
        complianceMap: Object.keys(complianceMap).reduce((acc, key) => {
            acc[key] = complianceMap[key];
            return acc;
        }, {})
    });
    
    // Generate SVG chart
    const svgChart = generateOverallComplianceChart(compliantRules, nonCompliantRules, insufficientDataRules, theme);
    
    return `
        <style>
            .compliance-widget {
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
            
            .overview-container {
                display: flex;
                gap: 16px;
                margin-bottom: 16px;
            }
            
            .chart-container {
                flex: 0 0 120px;
            }
            
            .summary-stats {
                flex: 1;
            }
            
            .stat-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
                padding: 4px 8px;
                border-radius: 3px;
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
            
            .rules-list {
                height: calc(100% - 180px);
                overflow-y: auto;
                flex: 1;
            }
            
            .rule-item {
                padding: 8px;
                border: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'};
                border-radius: 4px;
                margin-bottom: 6px;
                background: ${theme === 'dark' ? '#161b22' : '#f6f8fa'};
                cursor: pointer;
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
            }
            
            .rule-compliance {
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 3px;
                font-weight: 500;
            }
            
            .compliance-compliant {
                background: ${theme === 'dark' ? '#0c2d6b' : '#dafbe1'};
                color: ${theme === 'dark' ? '#58a6ff' : '#1a7f37'};
            }
            
            .compliance-noncompliant {
                background: ${theme === 'dark' ? '#5a1e1e' : '#ffebe9'};
                color: ${theme === 'dark' ? '#ff8182' : '#cf222e'};
            }
            
            .compliance-insufficient {
                background: ${theme === 'dark' ? '#3c2300' : '#fff8c5'};
                color: ${theme === 'dark' ? '#d29922' : '#9a6700'};
            }
            
            .rule-details {
                font-size: 10px;
                color: ${theme === 'dark' ? '#8b949e' : '#656d76'};
            }
        </style>
        
        <div class="compliance-widget" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div class="widget-header">
                <h3 class="widget-title">Compliance Summary</h3>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                    <span style="font-size: 10px; color: ${theme === 'dark' ? '#8b949e' : '#656d76'};">
                        ${totalRules} rules
                    </span>
                    ${accountId ? `<span style="font-size: 9px; color: ${theme === 'dark' ? '#656d76' : '#8b949e'}; font-family: monospace;">Account: ${accountId}</span>` : ''}
                </div>
            </div>
            
            <div class="overview-container">
                <div class="chart-container">
                    ${svgChart}
                </div>
                <div class="summary-stats">
                    <div class="stat-item stat-compliant">
                        <span>Compliant Rules:</span>
                        <span>${compliantRules}</span>
                    </div>
                    <div class="stat-item stat-noncompliant">
                        <span>Non-Compliant Rules:</span>
                        <span>${nonCompliantRules}</span>
                    </div>
                    <div class="stat-item stat-insufficient">
                        <span>Insufficient Data:</span>
                        <span>${insufficientDataRules}</span>
                    </div>
                </div>
            </div>
            
            <div class="rules-list">
                ${rules.map(rule => generateRuleSummaryItemHTML(rule, complianceMap[rule.ConfigRuleName], theme, accountId)).join('')}
            </div>
        </div>
    `;
}

/**
 * Generate SVG pie chart for compliance distribution
 */
function generateCompliancePieChart(compliantPercentage, nonCompliantPercentage, theme) {
    const radius = 50;
    const centerX = 60;
    const centerY = 60;
    
    const compliantAngle = (compliantPercentage / 100) * 360;
    const nonCompliantAngle = (nonCompliantPercentage / 100) * 360;
    
    const compliantColor = theme === 'dark' ? '#58a6ff' : '#1a7f37';
    const nonCompliantColor = theme === 'dark' ? '#ff8182' : '#cf222e';
    
    let compliantPath = '';
    let nonCompliantPath = '';
    
    if (compliantPercentage > 0) {
        const startAngle = 0;
        const endAngle = startAngle + compliantAngle;
        const startX = centerX + radius * Math.cos(startAngle * Math.PI / 180);
        const startY = centerY + radius * Math.sin(startAngle * Math.PI / 180);
        const endX = centerX + radius * Math.cos(endAngle * Math.PI / 180);
        const endY = centerY + radius * Math.sin(endAngle * Math.PI / 180);
        
        const largeArcFlag = compliantAngle > 180 ? 1 : 0;
        
        compliantPath = `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
    }
    
    if (nonCompliantPercentage > 0) {
        const startAngle = compliantAngle;
        const endAngle = startAngle + nonCompliantAngle;
        const startX = centerX + radius * Math.cos(startAngle * Math.PI / 180);
        const startY = centerY + radius * Math.sin(startAngle * Math.PI / 180);
        const endX = centerX + radius * Math.cos(endAngle * Math.PI / 180);
        const endY = centerY + radius * Math.sin(endAngle * Math.PI / 180);
        
        const largeArcFlag = nonCompliantAngle > 180 ? 1 : 0;
        
        nonCompliantPath = `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
    }
    
    return `
        <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${theme === 'dark' ? '#30363d' : '#d0d7de'}" stroke-width="2"/>
            ${compliantPath ? `<path d="${compliantPath}" fill="${compliantColor}"/>` : ''}
            ${nonCompliantPath ? `<path d="${nonCompliantPath}" fill="${nonCompliantColor}"/>` : ''}
            <text x="${centerX}" y="${centerY + 5}" text-anchor="middle" font-size="12" font-weight="600" fill="${theme === 'dark' ? '#e1e4e8' : '#24292e'}">
                ${Math.round(compliantPercentage)}%
            </text>
        </svg>
    `;
}

/**
 * Generate SVG chart for overall compliance
 */
function generateOverallComplianceChart(compliant, nonCompliant, insufficient, theme) {
    const total = compliant + nonCompliant + insufficient;
    if (total === 0) return '';
    
    const compliantPercentage = (compliant / total) * 100;
    const nonCompliantPercentage = (nonCompliant / total) * 100;
    const insufficientPercentage = (insufficient / total) * 100;
    
    const radius = 50;
    const centerX = 60;
    const centerY = 60;
    
    const compliantColor = theme === 'dark' ? '#58a6ff' : '#1a7f37';
    const nonCompliantColor = theme === 'dark' ? '#ff8182' : '#cf222e';
    const insufficientColor = theme === 'dark' ? '#d29922' : '#9a6700';
    
    let currentAngle = 0;
    const paths = [];
    
    if (compliant > 0) {
        const angle = (compliant / total) * 360;
        const startX = centerX + radius * Math.cos(currentAngle * Math.PI / 180);
        const startY = centerY + radius * Math.sin(currentAngle * Math.PI / 180);
        const endAngle = currentAngle + angle;
        const endX = centerX + radius * Math.cos(endAngle * Math.PI / 180);
        const endY = centerY + radius * Math.sin(endAngle * Math.PI / 180);
        
        const largeArcFlag = angle > 180 ? 1 : 0;
        paths.push(`<path d="M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z" fill="${compliantColor}"/>`);
        currentAngle = endAngle;
    }
    
    if (nonCompliant > 0) {
        const angle = (nonCompliant / total) * 360;
        const startX = centerX + radius * Math.cos(currentAngle * Math.PI / 180);
        const startY = centerY + radius * Math.sin(currentAngle * Math.PI / 180);
        const endAngle = currentAngle + angle;
        const endX = centerX + radius * Math.cos(endAngle * Math.PI / 180);
        const endY = centerY + radius * Math.sin(endAngle * Math.PI / 180);
        
        const largeArcFlag = angle > 180 ? 1 : 0;
        paths.push(`<path d="M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z" fill="${nonCompliantColor}"/>`);
        currentAngle = endAngle;
    }
    
    if (insufficient > 0) {
        const angle = (insufficient / total) * 360;
        const startX = centerX + radius * Math.cos(currentAngle * Math.PI / 180);
        const startY = centerY + radius * Math.sin(currentAngle * Math.PI / 180);
        const endAngle = currentAngle + angle;
        const endX = centerX + radius * Math.cos(endAngle * Math.PI / 180);
        const endY = centerY + radius * Math.sin(endAngle * Math.PI / 180);
        
        const largeArcFlag = angle > 180 ? 1 : 0;
        paths.push(`<path d="M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z" fill="${insufficientColor}"/>`);
    }
    
    return `
        <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${theme === 'dark' ? '#30363d' : '#d0d7de'}" stroke-width="2"/>
            ${paths.join('')}
            <text x="${centerX}" y="${centerY + 5}" text-anchor="middle" font-size="12" font-weight="600" fill="${theme === 'dark' ? '#e1e4e8' : '#24292e'}">
                ${total}
            </text>
        </svg>
    `;
}

/**
 * Generate HTML for resource items
 */
function generateResourceItemHTML(resource, theme) {
    let complianceClass = 'resource-noncompliant';
    if (resource.ComplianceType === 'COMPLIANT') {
        complianceClass = 'resource-compliant';
    } else if (resource.ComplianceType === 'INSUFFICIENT_DATA') {
        complianceClass = 'resource-insufficient';
    }
    
    const resourceId = resource.EvaluationResultIdentifier.EvaluationResultQualifier.ResourceId || 'Unknown';
    const resourceType = resource.EvaluationResultIdentifier.EvaluationResultQualifier.ResourceType || 'Unknown';
    
    return `
        <div class="resource-item ${complianceClass}" onclick="window.parent.postMessage({
            action: 'showResourceDetails',
            resourceId: '${resourceId}',
            resourceType: '${resourceType}'
        }, '*')">
            <div class="resource-id">${resourceId}</div>
            <div class="resource-type">${resourceType}</div>
        </div>
    `;
}

/**
 * Generate HTML for rule summary items
 */
function generateRuleSummaryItemHTML(rule, compliance, theme, accountId = null) {
    // Debug logging for iam-password-policy
    if (rule.ConfigRuleName === 'iam-password-policy') {
        console.log('generateRuleSummaryItemHTML for iam-password-policy:');
        console.log('  Rule:', rule.ConfigRuleName);
        console.log('  Compliance data:', JSON.stringify(compliance, null, 2));
    }
    
    if (!compliance) {
        compliance = {
            CompliantResourceCount: 0,
            NonCompliantResourceCount: 0,
            TotalResourceCount: 0
        };
    }
    
    // For account-level rules, if they have non-compliant resources, they should be considered non-compliant
    // even if TotalResourceCount is 0 (this handles cases like iam-password-policy)
    const isCompliant = compliance.NonCompliantResourceCount === 0 && compliance.TotalResourceCount > 0;
    const isNonCompliant = compliance.NonCompliantResourceCount > 0;
    const isInsufficient = compliance.TotalResourceCount === 0 && compliance.NonCompliantResourceCount === 0;
    
    // Debug logging for iam-password-policy
    if (rule.ConfigRuleName === 'iam-password-policy') {
        console.log('  Logic results:');
        console.log('    isCompliant:', isCompliant);
        console.log('    isNonCompliant:', isNonCompliant);
        console.log('    isInsufficient:', isInsufficient);
    }
    
    let complianceClass = 'compliance-insufficient';
    let complianceText = 'Insufficient Data';
    
    if (isCompliant) {
        complianceClass = 'compliance-compliant';
        complianceText = 'Compliant';
    } else if (isNonCompliant) {
        complianceClass = 'compliance-noncompliant';
        complianceText = 'Non-Compliant';
    }
    
    return `
        <div class="rule-item" onclick="window.parent.postMessage({
            action: 'showRuleDetails',
            ruleName: '${rule.ConfigRuleName}'
        }, '*')">
            <div class="rule-header">
                <span class="rule-name">${rule.ConfigRuleName}</span>
                <span class="rule-compliance ${complianceClass}">${complianceText}</span>
            </div>
            <div class="rule-details">
                ${compliance.TotalResourceCount > 0 ? 
                    `${compliance.CompliantResourceCount}/${compliance.TotalResourceCount} resources compliant` :
                    compliance.NonCompliantResourceCount > 0 ?
                        `Account (${compliance.NonCompliantResourceCount} non-compliant)` :
                        'No resources evaluated'
                }
                ${accountId ? `<br><span style="font-size: 9px; color: ${theme === 'dark' ? '#656d76' : '#8b949e'}; font-family: monospace;">Account: ${accountId}</span>` : ''}
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
                <div class="error-title">Compliance Widget Error</div>
                <div class="error-message">${error.message || 'An unknown error occurred while fetching compliance data.'}</div>
            </div>
            <div style="font-size: 11px; color: ${theme === 'dark' ? '#8b949e' : '#656d76'};">
                Check CloudWatch logs for more details.
            </div>
        </div>
    `;
} 