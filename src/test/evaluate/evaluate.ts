/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {TestP} from '../test';

export function addTests(testRunner) {
  // @ts-ignore unused xit/fit variables.
  const {it, fit, xit} = testRunner;

  it('evaluateBasic', async({p} : {p : TestP}) => {
    await p.launchAndLoad('data:text/html,blank');

    const r1 = p.log(await p.dap.evaluate({expression: `42`}));
    p.log(`No variables: ${r1.variablesReference === 0}`);

    const r2 = p.log(await p.dap.evaluate({expression: `'42'`}));
    p.log(`No variables: ${r2.variablesReference === 0}`);

    const r3 = p.log(await p.dap.evaluate({expression: `({foo: 42})`}));
    p.log(await p.dap.variables({variablesReference: r3.variablesReference}), 'Variables: ');
    p.assertLog();
  });

  it('setVariable', async({p} : {p: TestP}) => {
    await p.launchAndLoad('data:text/html,blank');

    const r1 = p.log(await p.dap.evaluate({expression: `window.x = ({foo: 42}); x`}), 'evaluate: ');
    p.log(await p.dap.variables({variablesReference: r1.variablesReference}), 'variables before: ');
    const r2 = p.log(await p.dap.setVariable({variablesReference: r1.variablesReference, name: 'foo', value: '{bar: 17}'}), 'setVariable: ');
    p.log(await p.dap.variables({variablesReference: r1.variablesReference}), 'variables after: ');
    p.log(await p.dap.variables({variablesReference: r2.variablesReference}), 'bar variables: ');
    p.log(await p.dap.setVariable({variablesReference: r1.variablesReference, name: 'foo', value: 'baz'}), 'setVariable failure: ');
    p.assertLog();
  });
}

