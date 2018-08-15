// This Babel plugin makes it possible to do CommonJS-style function exports

const walked = Symbol('walked');

module.exports = ({ types: t }) => ({
  visitor: {
    Program: {
      exit(program) {
        if (program[walked]) {
          return;
        }

        for (let path of program.get('body')) {
          if (path.isExpressionStatement()) {
            const expr = path.get('expression');
            if (expr.isAssignmentExpression() &&
                expr.get('left').matchesPattern('exports.*')) {
              const prop = expr.get('left').get('property');
              if (prop.isIdentifier({ name: 'default' })) {
                program.unshiftContainer('body', [
                  t.expressionStatement(
                    t.assignmentExpression('=',
                      t.identifier('exports'),
                      t.assignmentExpression('=',
                        t.memberExpression(
                          t.identifier('module'), t.identifier('exports')
                        ),
                        expr.node.right
                      )
                    )
                  ),
                  t.expressionStatement(
                    t.callExpression(
                      t.memberExpression(
                        t.identifier('Object'), t.identifier('defineProperty')),
                      [
                        t.identifier('exports'),
                        t.stringLiteral('__esModule'),
                        t.objectExpression([
                          t.objectProperty(t.identifier('value'), t.booleanLiteral(true))
                        ])
                      ]
                    )
                  ),
                  t.expressionStatement(
                    t.assignmentExpression('=',
                      expr.node.left, t.identifier('exports')
                    )
                  )
                ]);
                path.remove();
              }
            }
          }
        }

        program[walked] = true;
      }
    }
  }
});
