# Testing babble-drachtio-registrar

## General requirements

- [Node](https://nodejs.org/en/download/) with npm

## Test types available

One test type is available: unit. The set of test files is stored in a corresponding directory:

- test/unit/

The test type can be run with Mocha and Chai.

## Running tests - with Mocha & Chai

### Additional requirements

- [Mocha](https://mochajs.org/), the test framework used
- [Chai](https://www.chaijs.com/), the assertion library used

### Installing the packages

Both Mocha and Chai are listed as devDependencies in the package.json file and will have been installed if the `npm install` command was run for the babble-drachtio-registrar project.

Otherwise they can be installed separately:

```shell
npm install -D mocha chai
```

If beginning a new project, the `npm init` command can be run beforehand to generate a package.json file.

### Overview and examples

The `mocha` command is used to run tests. It can run a specific test file if passed the filename as the first argument. It can also run every test file listed in the current directory and any subdirectories with the `--recursive` flag.

If the `--watch` flag is added, the process will continue, running the tests again on saved changes to files in the current working directory.

Example: navigate to the directory containing the unit test files and run a named unit test file:

```shell
cd babble-drachtio-registrar/test/unit
mocha index.spec.js
```

Example: navigate to the project root and run all unit tests:

```shell
cd babble-drachtio-registrar
mocha --recursive
```

Replace the `mocha` command with `clear && mocha` to clear the screen each time.

#### Test scripts

The package.json file for the babble-drachtio-registrar project contains two scripts: 'test' and 'code'.

The 'test' script currently contains the `mocha --recursive` command and can be run with the `npm test` or `npm run test` command.

The 'code' script currently contains the `mocha --watch --recursive` command and can be run with the `npm run code` command.

## Writing tests

### File paths

Test files are placed in the test/ directory in an appropriate subdirectory, e.g. test/unit/, with a filename containing the .spec suffix.

### Dependencies

Test files begin by requiring dependencies, including the file under test. Order of requirement may be significant.

For the requirement syntax for the Chai assertion library, see [Asserting an outcome](#asserting-an-outcome) below.

The following auxiliary files are available:

- request.js, a mock for the `Request` object, which can be found in the mock/ directory
- cleanup.js, with a utility function to clear the regexpiretimer property on a reg instance, which can be found in the util/ directory

### describe-it syntax

The test framework uses a describe-it nested function syntax. The test file contains one or more `describe` calls, each with one or more nested `it` calls.

```js
describe( "thing", function() {

  it( "does something", function() {
    // ...
  } )

  // ...
} )
```

A `describe` call takes two arguments, a string and a function. The string is the name of the element under test, i.e. the route, class, function etc. The function may have multiple nested `describe` and `it` calls. Each `it` call corresponds to a functionality of the element under test.

An `it` call also takes two arguments, a string and a function. The string is a description of an expected outcome. The function contains the logic required to demonstrate that this occurs. If the logic makes use of callbacks, the function should be passed the `done` method as an argument.

### Test case structure

The logic required to demonstrate an expected outcome will vary. However, this logic will usually make use of the Chai `should` syntax, even if the use of `should` is the only logic in the test case.

### Asserting an outcome

Require Chai and call the `should` function:

```js
const should = require( "chai" ).should()
```

Assert an expected outcome, here a return value from a function under test:

```js
functionUnderTest().should.equal( expectedValue )
```

Where the value is `undefined`, use the alternative syntax:

```js
should.equal( functionUnderTest(), undefined )
```

The chainable elements available beyond `.equal` are described in the [documentation](https://www.chaijs.com/api/bdd/).

## Test coverage

### Unit tests

babble-drachtio-registrar/

- [x] index.js
- [x] lib/
  - [x] domain.js
  - [x] reg.js
  - [x] registrar.js
  - [x] user.js

### Interface tests

events

- [ ] register
  - [x] via Registrar instance reg method
  - [ ] configured with options ping
  - [ ] configured with reg ping
- [x] unregister
  - [x] as timeout
  - [x] as request by client, via user instance remove method

### Known issues

...

## Future tasks

- implement integration testing
- refactor modules:
  - consider revision of registration removal and destruction
