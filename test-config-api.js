const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const config = new AWS.ConfigService();

async function testConfigAPI() {
    try {
        console.log('=== Testing AWS Config API ===\n');
        
        // Test 1: Get all rules
        console.log('1. Getting all Config rules...');
        const rulesResponse = await config.describeConfigRules().promise();
        console.log('Total rules found:', rulesResponse.ConfigRules.length);
        console.log('Rule names:', rulesResponse.ConfigRules.map(r => r.ConfigRuleName));
        
        // Test 2: Get compliance summary
        console.log('\n2. Getting compliance summary...');
        const complianceResponse = await config.getComplianceSummaryByConfigRule().promise();
        console.log('Compliance summary entries:', complianceResponse.ComplianceSummaryByConfigRule.length);
        
        // Test 3: Find iam-password-policy specifically
        console.log('\n3. Looking for iam-password-policy...');
        const iamPasswordPolicy = complianceResponse.ComplianceSummaryByConfigRule.find(
            item => item.ConfigRuleName === 'iam-password-policy'
        );
        
        if (iamPasswordPolicy) {
            console.log('Found iam-password-policy:');
            console.log(JSON.stringify(iamPasswordPolicy, null, 2));
        } else {
            console.log('iam-password-policy NOT found in compliance summary');
        }
        
        // Test 4: Get detailed compliance for iam-password-policy
        console.log('\n4. Getting detailed compliance for iam-password-policy...');
        try {
            const detailsResponse = await config.getComplianceDetailsByConfigRule({
                ConfigRuleName: 'iam-password-policy',
                ComplianceTypes: ['NON_COMPLIANT', 'COMPLIANT', 'INSUFFICIENT_DATA'],
                Limit: 100
            }).promise();
            
            console.log('Detailed compliance results:', detailsResponse.EvaluationResults.length);
            console.log('Results:', JSON.stringify(detailsResponse.EvaluationResults, null, 2));
        } catch (error) {
            console.log('Error getting detailed compliance:', error.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testConfigAPI(); 