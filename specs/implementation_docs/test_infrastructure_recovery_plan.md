# Test Infrastructure Recovery Plan (WOR-76)

## Executive Summary

**Current State**: 11 test suites failing (70% success rate)  
**Target State**: 100% test pass rate  
**Priority**: CRITICAL - Foundation blocking feature development  

## Detailed Analysis

### Test Suite Status

```
Test Suites: 11 failed, 26 passed, 37 total
Tests:       5 failed, 3 skipped, 329 passed, 337 total
```

### Critical Issues Identified

#### PRIORITY 1: TypeScript Compilation Errors (BLOCKING)

**Issue 1.1: Error Type Inference**

- **File**: `tests/planning/linear-issue-creator.test.ts:158`
- **Error**: `Argument of type 'Error' is not assignable to parameter of type 'never'`
- **Root Cause**: `mockRejectedValue(error)` infers `never` type in strict mode
- **Fix**: Replace with `mockImplementation(() => Promise.reject(error))`
- **Impact**: Test compilation failure

**Issue 1.2: Undefined Property Access**

- **File**: `tests/sync/sync-manager.test.ts:219`
- **Error**: `'options.syncIntervalMs' is possibly 'undefined'`
- **Root Cause**: TypeScript strict mode null checking
- **Fix**: Add null coalescing: `options.syncIntervalMs || 5000`
- **Impact**: TypeScript compilation failure

#### PRIORITY 2: Enhanced Slack Notifier Throttling (FUNCTIONAL)

**Issue 2.1: Throttling Logic Broken**

- **File**: `tests/integrations/enhanced-slack-notifier.test.ts`
- **Error**: Expected 1 call, received 2 calls
- **Root Cause**: Throttling mechanism not preventing duplicate notifications
- **Impact**: Production notification spam risk

**Issue 2.2: Integration Throttling**

- **File**: `tests/integrations/enhanced-slack-notifier.integration.test.ts`
- **Error**: Expected false, received true (throttling not working)
- **Root Cause**: Real-time throttling logic failure
- **Impact**: Integration test failures

#### PRIORITY 3: OAuth Integration Failures

**Issue 3.1: OAuth E2E Tests**

- **File**: `tests/auth/oauth-e2e.test.ts`
- **Status**: FAILING
- **Impact**: Authentication flow broken
- **Investigation**: Required

**Issue 3.2: System Health Integration**

- **File**: `tests/system-health-integration.test.ts`
- **Status**: FAILING
- **Impact**: Health monitoring broken
- **Investigation**: Required

## Execution Plan

### Phase 1: Foundation Recovery (TypeScript Compilation)

**Objective**: Achieve 100% test compilation success

**Tasks**:

1. Fix Error type inference in linear-issue-creator.test.ts
2. Fix undefined property access in sync-manager.test.ts
3. Verify all test files compile without errors
4. Run compilation test: `npx tsc --noEmit`

**Success Criteria**: Zero TypeScript compilation errors

### Phase 2: Core Functionality (Slack Notifier)

**Objective**: Fix notification throttling mechanism

**Tasks**:

1. Investigate throttling logic in EnhancedSlackNotifier
2. Debug why notifications aren't being throttled
3. Fix throttling implementation
4. Verify throttling works in both unit and integration tests

**Success Criteria**: All Slack notifier tests pass

### Phase 3: Integration Recovery (OAuth)

**Objective**: Restore authentication and health monitoring

**Tasks**:

1. Investigate OAuth E2E test failures
2. Debug authentication flow issues
3. Fix system health integration tests
4. Verify end-to-end authentication works

**Success Criteria**: All OAuth and health tests pass

### Phase 4: Final Validation

**Objective**: Achieve 100% test pass rate

**Tasks**:

1. Run full test suite: `npm test`
2. Verify all 37 test suites pass
3. Document any remaining issues
4. Create follow-up tickets if needed

**Success Criteria**:

- Test Suites: 0 failed, 37 passed
- Tests: 0 failed, 0 skipped, all passed

## Risk Assessment

**High Risk**:

- Throttling issues could cause production notification spam
- OAuth failures could break user authentication

**Medium Risk**:

- TypeScript errors blocking development workflow

**Low Risk**:

- Individual test failures (isolated impact)

## Timeline

**Phase 1**: 30 minutes (compilation fixes)  
**Phase 2**: 60 minutes (throttling investigation and fix)  
**Phase 3**: 45 minutes (OAuth investigation and fix)  
**Phase 4**: 15 minutes (validation)  

**Total Estimated Time**: 2.5 hours

## Success Metrics

- **Before**: 11 failed test suites (70% success)
- **After**: 0 failed test suites (100% success)
- **Foundation**: Ready for feature development
- **Quality**: High confidence in test infrastructure

## Next Steps

1. Execute Phase 1 (TypeScript compilation fixes)
2. Validate compilation success
3. Proceed to Phase 2 (Slack notifier throttling)
4. Continue systematic execution through all phases
5. Document lessons learned for SAFe Pulse integration

---

**Architect**: Auggie III  
**Issue**: WOR-76  
**Priority**: CRITICAL  
**Status**: EXECUTION READY
