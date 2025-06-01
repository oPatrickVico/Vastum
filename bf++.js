/**
 * Ideas:
 * - wrap flag: each cell remembers the number of wraps - both positively and negatively.
 * - computable macros: macrros that take arguments
 * - macro coding: in the website, add a way to write, highlight and fill in macros with their text - essentially streamlinig macro creation
 * - Multiple tape heads:
 *      - Input and output are relative and configurable buffers; 
 *      - multiple programs running where I produce in one buffer and read it in the other by using multiple tape heads; 
 *      - stdin, stdout an stderr are simply defaulted to buffers 0, 1 and 2 - but they can be changed!! They just _start_ at those values (though I only need in and out for now);
 *      - tapes each have their own head and have their own stdin and stdout  channels, connected to other buffers
*       - threads can read and write to each other's tapes 
* - sleep and concurrency sys_calls
 * - code is just another tape
 *      - You must now also have a way to connect tapes, to keep them running
 *      - a mini operating system, if you will
 *      - so this mini os can do "mallocs" asking for new tapes (new memory, really)
 *      - tapes can have configurable sizes
 *      - tapes show also have flags and next_tape addresses
 * - Have a screen that reads buffers and outputs 
 *      - it can have a 256 bit color scheme (https://www.ditig.com/256-colors-cheat-sheet)
 * 
 * - functions are simply macros with some setup:
 *      - they would expect values in certain relative addresses, sure
 *      - but you can parameterize that way and simply run the macros
 */

/**
 * many tapes
 * code is just another tape
 * you can cycle through tapes
 * tapes have os meta-data
 * threads allow you to read and write from each others buffers (or they could share some tapes)
 * you can change the stdin and stdout from the default values to other tapes so you can use the values witout making a mess in the buffer tape (if you read a file, you don't want to have your logic mess the file. You could use the stack, but nah; I copy the values from another tape, do my business and then output to another tape.)
 */

/**
 * Should dump print each character or the whole buffer?
 * I can have the equivalent of print char to print out the current value,
 * AND a syscall that dumps the whole tape, filtering out the 0 character
 */

function preprocess() {
  macros.forEach((pair) => {
    const [macro, text] = pair;
    code = code.replaceAll(macro, text);
  });
}

let iota = 0;
const TOKEN_TYPE = Object.freeze({
  PLUS: iota++,
  MINUS: iota++,
  LESSER: iota++,
  GREATER: iota++,
  OPEN_BRACKET: iota++,
  CLOSED_BRACKET: iota++,
  PUSH_STACK: iota++,
  POP_STACK: iota++,
  SYS_CALL: iota++,
  WRITE_ASCII: iota++,
  WRITE_INTEGER: iota++,
});

const SYS_CALLS = Object.freeze({
  JUMP: 0,
  PRINT_ADDR: 1,
  CYCLE_TAPE: 2,
});

function make_token(type, value) {
  let token = { type, value };
  tokens.push(token);
  return token;
}

function tokenize() {
  while (cursor < code.length) {
    const char = eat_char();
    switch (char) {
      case "+": {
        let reps = 1;
        while (peek_char() === "+") reps++, eat_char();
        make_token(TOKEN_TYPE.PLUS, reps);
        break;
      }
      case "-": {
        let reps = 1;
        while (peek_char() === "-") reps++, eat_char();
        make_token(TOKEN_TYPE.MINUS, reps);
        break;
      }
      case ">": {
        let reps = 1;
        while (peek_char() === ">") reps++, eat_char();
        make_token(TOKEN_TYPE.GREATER, reps);
        break;
      }
      case "<": {
        let reps = 1;
        while (peek_char() === "<") reps++, eat_char();
        make_token(TOKEN_TYPE.LESSER, reps);
        break;
      }
      case "[": {
        let token = make_token(TOKEN_TYPE.OPEN_BRACKET, 0);
        jmp_stack.push(token);
        break;
      }
      case "]": {
        let closed = jmp_stack.pop();
        let token = make_token(
          TOKEN_TYPE.CLOSED_BRACKET,
          tokens.findIndex((el) => el === closed)
        );
        closed.value = tokens.length - 1;
        break;
      }
      case "#": {
        make_token(TOKEN_TYPE.PUSH_STACK, 0);
        break;
      }
      case "$": {
        make_token(TOKEN_TYPE.POP_STACK, 0);
        break;
      }
      case "@": {
        make_token(TOKEN_TYPE.SYS_CALL, 0);
        break;
      }
      case ".": {
        make_token(TOKEN_TYPE.WRITE_ASCII, 0);
        break;
      }
      case ";": {
        make_token(TOKEN_TYPE.WRITE_INTEGER, 0);
        break;
      }
    }
  }
}

function interpret() {
  for (; code_cursor < tokens.length; code_cursor++) {
    let token = tokens[code_cursor];

    switch (token.type) {
      case TOKEN_TYPE.PLUS: {
        for (let i = token.value; i > 0; i--) {
          tape()[tape_cursor]++;
          if (tape()[tape_cursor] > 255) tape()[tape_cursor] = 0;
        }
        break;
      }
      case TOKEN_TYPE.MINUS: {
        for (let i = token.value; i > 0; i--) {
          tape()[tape_cursor]--;
          if (tape()[tape_cursor] < 0) tape()[tape_cursor] = 255;
        }
        break;
      }
      case TOKEN_TYPE.LESSER: {
        for (let i = token.value; i > 0; i--) {
          tape_cursor--;
          if (tape_cursor < 0) throw new Error(`tape cursor out of bounds`);
        }
        break;
      }
      case TOKEN_TYPE.GREATER: {
        for (let i = token.value; i > 0; i--) {
          tape_cursor++;
          if (tape_cursor >= TAPE_LIMIT)
            throw new Error(`tape cursor out of bounds`);
        }
        break;
      }
      case TOKEN_TYPE.OPEN_BRACKET: {
        break;
      }
      case TOKEN_TYPE.CLOSED_BRACKET: {
        if (tape()[tape_cursor] > 0) {
          code_cursor = token.value;
        }
        break;
      }
      case TOKEN_TYPE.PUSH_STACK: {
        tape_stack.push(tape()[tape_cursor]);
        break;
      }
      case TOKEN_TYPE.POP_STACK: {
        tape()[tape_cursor] = tape_stack.pop() ?? 0;
        break;
      }
      case TOKEN_TYPE.SYS_CALL: {
        sys_call();
        break;
      }
      case TOKEN_TYPE.WRITE_ASCII: {
        output.push(String.fromCharCode(tape()[tape_cursor]));
        break;
      }
      case TOKEN_TYPE.WRITE_INTEGER: {
        output.push(tape()[tape_cursor]);
        break;
      }
    }
  }
}

function sys_call() {
  const sys_call_id = tape()[tape_cursor];
  switch (sys_call_id) {
    case SYS_CALLS.JUMP: {
      // Jump
      let addr = tape_stack.pop() ?? 0;
      tape_cursor = addr;
      if (tape_cursor >= TAPE_LIMIT) throw new Error("tape outside of limits");
      break;
    }
    case SYS_CALLS.PRINT_ADDR: {
      // Set current cell value to current address value
      tape()[tape_cursor] = tape_cursor;
      break;
    }
    case SYS_CALLS.CYCLE_TAPE: {
      // cycle tapes
      if (tape()[tape_cursor]) {
        tape_idx++;
      } else {
        tape_idx--;
      }
    }
  }
}

let fibb = `
    ++++++++++++
    >+<
    [
        >#dupr
        <-#0>$
    ]
    >#0>0
    #@
    >$[>$][;_<]
`;

let code = `++>+++mult`;

let oldCode = code.slice();

const macros = [
    ["mult", ""],
    ["_", "0" + "+".repeat(32) + "."],
    ["set(80)", "0>0>0<<++++[>++++[>+++++<-]<-]>>[<<+>>-]<<"],
    ["set(100)", "0>0>0<<++++[>+++++[>+++++<-]<-]>>[<<+>>-]<<"],
    ["dec_sc", "$-#"],
    ["jmp", "#0@"],
    ["dupr", "[>+>+<<-]"],
    ["dupl", "[<+<+>>-]"],
    ["0", "[-]"],
];

let cursor = 0;
const inc_cur = (amt) => (cursor += amt);
const eat_char = () => code[cursor++];
const peek_char = () => code[cursor];

const tokens = [];
let jmp_stack = [];

const TAPE_LIMIT = 100;

let input = "greetings, mortal".split("").map((c) => c.charCodeAt(0));
let output = [];
let tape1 = new Array(TAPE_LIMIT).fill(0);
let tapes = [tape1];
let tape_idx = tapes.findIndex((t) => t === tape1);
let tape = () => tapes[tape_idx];
let tape_cursor = 0;
let tape_stack = [];
let code_cursor = 0;

function main() {
  console.clear();
  preprocess();
  tokenize();
  interpret();
//   console.log("------------ Output ------------");
  console.log(output.join(""));
//   console.log("------------ State --------------");
//   console.log(tape());
//   console.log("tape stakc: ", tape_stack);
//   console.log("tape index: ", tape_idx);
//   console.log("tape cursor: ", tape_cursor);
//   console.log("------------ Code ---------------");
//   console.log("   ---  Source:   ---  ");
//   console.log(oldCode);
//   console.log("   ---   Processed:   ---  ");
//   console.log(code);
//   console.log("---------------------------------");
}

main();
