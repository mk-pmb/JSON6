// json6.js
// JSON for Humans. See README.md for details.
//
// This file is based off of https://github.com/d3x0r/sack  ./src/netlib/html5.websocket/json6_parser.c
// 


const _DEBUG_PARSING = false;
const _DEBUG_PARSING_STACK = false;

/*
Code Point	Name	Abbreviation	Usage
U+200C	ZERO WIDTH NON-JOINER	<ZWNJ>	IdentifierPart
U+200D	ZERO WIDTH JOINER	<ZWJ>	IdentifierPart
U+FEFF	ZERO WIDTH NO-BREAK SPACE	<ZWNBSP>	WhiteSpace
*/

/*
ID_Start       XID_Start        Uppercase letters, lowercase letters, titlecase letters, modifier letters
                                , other letters, letter numbers, stability extensions
ID_Continue    XID_Continue     All of the above, plus nonspacing marks, spacing combining marks, decimal numbers
                                , connector punctuations, stability extensions. 
                                These are also known simply as Identifier Characters, since they are a superset of 
                                the ID_Start. The set of ID_Start characters minus the ID_Continue characters are 
                                known as ID_Only_Continue characters.
*/


const	VALUE_UNDEFINED = -1
const VALUE_UNSET = 0
const VALUE_NULL = 1
const VALUE_TRUE = 2
const VALUE_FALSE = 3
const VALUE_STRING = 4
const VALUE_NUMBER = 5
const VALUE_OBJECT = 6
const VALUE_ARRAY = 7
const VALUE_NEG_NAN = 8
const VALUE_NAN = 9
const VALUE_NEG_INFINITY = 10
const VALUE_INFINITY = 11

const	WORD_POS_RESET = 0;
const	WORD_POS_TRUE_1 = 1;
const	WORD_POS_TRUE_2 = 2;
const	WORD_POS_TRUE_3 = 3;
const	WORD_POS_TRUE_4 = 4;
const	WORD_POS_FALSE_1 = 5; 
const	WORD_POS_FALSE_2 = 6;
const	WORD_POS_FALSE_3 = 7;
const	WORD_POS_FALSE_4 = 8;
const	WORD_POS_NULL_1 = 9;
const	WORD_POS_NULL_2 = 10;
const	WORD_POS_NULL_3 = 11;
const	WORD_POS_UNDEFINED_1 = 12;
const	WORD_POS_UNDEFINED_2 = 13;
const	WORD_POS_UNDEFINED_3 = 14;
const	WORD_POS_UNDEFINED_4 = 15;
const	WORD_POS_UNDEFINED_5 = 16;
const	WORD_POS_UNDEFINED_6 = 17;
const	WORD_POS_UNDEFINED_7 = 18;
const	WORD_POS_UNDEFINED_8 = 19;
const	WORD_POS_NAN_1 = 20;
const	WORD_POS_NAN_2 = 21;
const	WORD_POS_INFINITY_1 = 22;
const	WORD_POS_INFINITY_2 = 23;
const	WORD_POS_INFINITY_3 = 24;
const	WORD_POS_INFINITY_4 = 25;
const	WORD_POS_INFINITY_5 = 26;
const	WORD_POS_INFINITY_6 = 27;
const	WORD_POS_INFINITY_7 = 28;


const CONTEXT_UNKNOWN = 0
const CONTEXT_IN_ARRAY = 1
const CONTEXT_IN_OBJECT = 2
const CONTEXT_OBJECT_FIELD = 3
const CONTEXT_OBJECT_FIELD_VALUE = 4

function getContext() { return { context : CONTEXT_UNKNOWN, elements : null, element_array : null } }

var JSON6 = (typeof exports === 'object' ? exports : {});

JSON6.escape = function(string) {
	
	var n;
	var m = 0;
	var output = '';
	if( !string ) return string;
	for( n = 0; n < string.length; n++ ) {
		if( ( string[n] == '"' ) || ( string[n] == '\\' ) || ( string[n] == '`' )|| ( string[n] == '\'' )) {
			output += '\\';
		}
		output += string[n];
	}
	return output;
}




JSON6.parse = function( msg ) {

	/* I guess this is a good parser */
	//size_t m = 0; // m is the output path; leave text inline; but escaped chars can offset/change the content
	var mOut = '';
        var pos = { line:1, col:1, n:0 };
	var msg_length = msg.length;

	var word = WORD_POS_RESET;
	var c;
	var cInt;
	var status = true;
	var negative = false;
	let result;
	let elements;
	let element_array;
	var context_stack = [];

	var first_token = true;
	var context = getContext();
	var parse_context = CONTEXT_UNKNOWN;
	var val = { name : null,	  // name of this value (if it's contained in an object)
	 	value_type: VALUE_UNSET, // value from above indiciating the type of this value
	 	string : '',   // the string value of this value (strings and number types only)
                contains : null,
	};
	var comment = 0;


	function RESET_VAL()  {  
		val.value_type = VALUE_UNSET; 
		val.string = '';                
	}

	function arrayPush() {
		switch( val.value_type ){
		case VALUE_NUMBER:
			let tmp = new Number( val.string ) * (val.negative?-1:1);
			element_array.push( tmp );
			break;
		case VALUE_STRING:
			element_array.push( val.string );
			break;
		case VALUE_NEG_NAN:
			element_array.push( -NaN );
			break;
		case VALUE_NAN:
			element_array.push( NaN );
			break;
		case VALUE_NEG_INFINITY:
			element_array.push( -Infinity );
			break;
		case VALUE_INFINITY:
			element_array.push( Infinity );
			break;
		case VALUE_NULL:
			element_array.push( null );
			break;
		case VALUE_UNDEFINED:
			element_array.push( undefined );
			break;      
		}
	}
	function objectPush() {
		switch( val.value_type ){
		case VALUE_NUMBER:
			//console.log( "convert number store object:", val.string );
			let tmp = new Number( val.string ) * (val.negative?-1:1);
			elements[val.name] = tmp;
			break;
		case VALUE_STRING:
			elements[val.name] = ( val.string );
			break;
		case VALUE_NEG_NAN:
			elements[val.name] = ( -NaN );
			break;
		case VALUE_NAN:
			elements[val.name] = ( NaN );
			break;
		case VALUE_NEG_INFINITY:
			elements[val.name] = ( -Infinity );
			break;
		case VALUE_INFINITY:
			elements[val.name] = ( Infinity );
			break;
		case VALUE_NULL:
			elements[val.name] = ( null );
			break;
		case VALUE_UNDEFINED:
			elements[val.name] = ( undefined );
			break;      
		}
	}

	function gatherString( ) {
		//var mOut = '';
		// collect a string
		var status = true;
		var start_c = c.charCodeAt(0);//c;
		var escape;
		var cr_escaped;
		escape = 0;
		cr_escaped = false;
		while( ( ( pos.n < msg.length ) && (c = msg.charAt(pos.n++) ) ) && status )
		{
			let cInt = c.charCodeAt(0);
			pos.col++;
			if( cInt == 92/*'\\'*/ )
			{      
				if( escape ) val.string += '\\';
				else escape = 1;
			}
			else if( ( cInt == 34/*'"'*/ ) || ( cInt == 39/*'\''*/ ) || ( cInt == 96/*'`'*/ ) )
			{
				if( escape ) { val.string += c; escape = false; }
				else if( cInt == start_c ) {
					break;
				} else val.string += c; // other else is not valid close quote; just store as content.
			}
			else
			{
				if( cr_escaped ) {
					cr_escaped = false;								
					if( cInt == 10/*'\n'*/ ) {
						pos.line++;
						pos.col = 1;
						escape = false;
						continue;
					}
				}
				if( escape )
				{
					switch( cInt )
					{
					case 13/*'\r'*/:
						cr_escaped = true;
						continue;
					case 10/*'\n'*/:
						pos.line++;
						pos.col = 1;
						if( cr_escaped ) cr_escaped = false;
						// fall through to clear escape status <CR><LF> support.
					case 2028: // LS (Line separator)
					case 2029: // PS (paragraph separate)
						escape = false;
						continue;
					case 47/*'/'*/:
					case 92/*'\\'*/:
					case 34/*'"'*/:
						val.string += c;
						break;
					case 116/*'t'*/:
						val.string += '\t';
						break;
					case 98/*'b'*/:
						val.string += '\b';
						break;
					case 110/*'n'*/:
						val.string += '\n';
						break;
					case 114/*'r'*/:
						val.string += '\r';
						break;
					case 102/*'f'*/:
						val.string += '\f';
						break;
					case 48/*'0'*/: case 49/*'1'*/: case 50/*'2'*/: case 51/*'3'*/: 
						{
							var oct_char = c.codePointAt(0) - 48;
							var ofs;
							for( ofs = 0; ofs < 2; ofs++ )
							{
								//c = msg.charAt(pos.n++);
								cInt = msg.charCodeAt(pos.n++);
								oct_char *= 8;
								if( cInt >= 48/*'0'*/ && cInt <= 57/*'9'*/ )  oct_char += cInt/*.codePointAt(0)*/ - 0x30;
								else { pos.n--; break; }
							}
							if( oct_char > 255 ) {
								console.log( ("(escaped character, parsing octal escape val=%d) fault while parsing; )") (" (near %*.*s[%c]%s)")
								                 , oct_char
										 , ( (n>3)?3:n ), ( (n>3)?3:n )
										 , msg.substr( pos.n - ( (n>3)?3:n ), ( (n>3)?3:n ) )
										 , c
										 , msg.substr( pos.n +1, 10 )
										 );// fault
								status = false;
								break;
							} else { 
								val.string += String.fromCodePoint( oct_char );
							}
						}
						break;
					case 120/*'x'*/:
						{
							var hex_char;
							var ofs;
							hex_char = 0;
							for( ofs = 0; ofs < 2; ofs++ )
							{
								//c = msg.charAt(pos.n++);
								cInt = msg.charCodeAt(pos.n++);
								hex_char *= 16;
								if( cInt >= 48/*'0'*/ && cInt <= 57/*'9'*/ )      hex_char += cInt/*c.codePointAt(0)*/ - 0x30;
								else if( cInt >= 65/*'A'*/ && cInt <= 70/*'F'*/ ) hex_char += ( cInt/*c.codePointAt(0)*/ - 65 ) + 10;
								else if( cInt >= 97/*'a'*/ && cInt <= 102/*'f'*/ ) hex_char += ( cInt/*c.codePointAt(0)*/ - 96 ) + 10;
								else {
									console.log( ("(escaped character, parsing hex of \\x) fault while parsing; '%c' unexpected at %3 (near %*.*s[%c]%s)"), c, n
											 , ( (n>3)?3:n ), ( (n>3)?3:n )
										 , msg.substr( pos.n - ( (n>3)?3:n ), ( (n>3)?3:n ) )
										 , c
										 , msg.substr( pos.n +1, 10 )
											 );// fault
									status = false;
								}
							}
							val.string += String.fromCodePoint( mOut, hex_char );
						}
						break;
					case 117/*'u'*/:
						{
							var hex_char;
							var ofs;
							var codePointLen;
							var endCode;
							hex_char = 0;
							codePointLen = 4;
							endCode = 0;
							for( ofs = 0; ofs < codePointLen && ( c != endCode ); ofs++ )
							{
								//c = msg.charAt(pos.n++);
								cInt = msg.charCodeAt(pos.n++);
								if( !ofs && cInt == 123/*'{'*/ ) {
									codePointLen = 5; // collect up to 5 chars.
									endCode = '}';
									continue;
								} 
								if( c == '}' ) continue;
								hex_char *= 16;
								if( cInt >= 48/*'0'*/ && cInt <= 57/*'9'*/ )      hex_char += cInt/*c.codePointAt(0)*/ - 0x30;
								else if( cInt >= 65/*'A'*/ && cInt <= 70/*'F'*/ ) hex_char += ( cInt/*c.codePointAt(0)*/ - 65 ) + 10;
								else if( cInt >= 97/*'a'*/ && cInt <= 102/*'f'*/ ) hex_char += ( cInt/*c.codePointAt(0)*/ - 96 ) + 10;
								else
									console.log( ("(escaped character, parsing hex of \\u) fault while parsing; '%c' unexpected at %d (near %*.*s[%c]%s)"), c, n
											 , ( (n>3)?3:n ), ( (n>3)?3:n )
										 , msg.substr( pos.n - ( (n>3)?3:n ), ( (n>3)?3:n ) )
										 , c
										 , msg.substr( pos.n +1, 10 )
											 );// fault
							}
							val.string += String.fromCodePoint( mOut, hex_char );
						}
						break;
					default:
						if( cr_escaped ) {
							cr_escaped = false;
							escape = false;
							val.string += c;
						}										
						else {
							console.log( ("(escaped character) fault while parsing; '%c' unexpected %d (near %*.*s[%c]%s)"), c, n
								 , ( (n>3)?3:n ), ( (n>3)?3:n )
										 , msg.substr( pos.n - ( (n>3)?3:n ), ( (n>3)?3:n ) )
										 , c
										 , msg.substr( pos.n +1, 10 )
								 );// fault
							status = false;
						}
						break;
					}
					escape = 0;
				}
				else {
					val.string += c;
				}
			}
		}
		//console.log( "String:", val.string );
		return status;
	}



	while( status && ( pos.n < msg_length ) && ( c = msg.charAt(pos.n++) ) )
	{
		cInt = c.charCodeAt(0);
		pos.col++;
		if( comment ) {
			if( comment == 1 ) {
				if( c == '*' ) { comment = 3; continue; }
				if( c != '/' ) { console.log( ("Fault while parsing; unexpected '%s' at %d  %d:%d"), c, pos.n, pos.line, pos.col ); status = false; }
				else comment = 2;
				continue;
			}
			if( comment == 2 ) {
				if( c == '\n' ) { comment = 0; continue; }
				else continue;
			}
			if( comment == 3 ){
				if( c == '*' ) { comment = 4; continue; }
				else continue;
			}
			if( comment == 4 ) {
				if( c == '/' ) { comment = 0; continue; }
				else { if( c != '*' ) comment = 3; continue; }
			}
		}
		switch( cInt )
		{
		case 47/*'/'*/:
			if( !comment ) comment = 1;
			break;
		case 123/*'{'*/:
			{
				var old_context = getContext();
				if( _DEBUG_PARSING )
				console.log( "Begin a new object; previously pushed into elements; but wait until trailing comma or close previously:%d", val.value_type );
				
				val.value_type = VALUE_OBJECT;
				let tmpobj = {};
				if( parse_context == CONTEXT_UNKNOWN )
					result = elements = tmpobj;
				else if( parse_context == CONTEXT_IN_ARRAY )
					element_array.push( tmpobj );
				else if( parse_context == CONTEXT_OBJECT_FIELD_VALUE )
					elements[val.name] = tmpobj;

				old_context.context = parse_context;
				old_context.elements = elements;
				old_context.element_array = element_array;
				elements = tmpobj;
				if( _DEBUG_PARSING_STACK ) console.log( "push context (open object): ", context_stack.length );
				context_stack.push( old_context );
				RESET_VAL();
				parse_context = CONTEXT_OBJECT_FIELD;
			}
			break;

		case 91/*'['*/:
			if( parse_context == CONTEXT_OBJECT_FIELD ) {
				console.log( ("Fault while parsing; while getting field name unexpected '%s' at %d  %d:%"), c, pos.n, pos.line, pos.col );
				status = false;
				break;
			}
			{
				var old_context = getContext();
				if( _DEBUG_PARSING )
				console.log( "Begin a new array; previously pushed into elements; but wait until trailing comma or close previously:%d", val.value_type );

				val.value_type = VALUE_ARRAY;
				let tmparr = [];
				if( parse_context == CONTEXT_UNKNOWN )
					result = element_array = tmparr;
				else if( parse_context == CONTEXT_IN_ARRAY )
					element_array.push( tmparr );
				else if( parse_context == CONTEXT_OBJECT_FIELD_VALUE )
					elements[val.name] = tmparr;

				old_context.context = parse_context;
				old_context.elements = elements;
				old_context.element_array = element_array;
				element_array = tmparr;
				if( _DEBUG_PARSING_STACK ) console.log( "push context (open array): ", context_stack.length );
				context_stack.push( old_context );

				RESET_VAL();
				parse_context = CONTEXT_IN_ARRAY;
			}
			break;

		case 58/*':'*/:
			if(_DEBUG_PARSING) console.log( "colon context:", parse_context );
			if( parse_context == CONTEXT_OBJECT_FIELD )
			{
				//val.string = mOut;
				//mOut = '';
				word = WORD_POS_RESET;
				val.name = val.string;
				val.string = '';
				parse_context = CONTEXT_OBJECT_FIELD_VALUE;
				val.value_type = VALUE_UNSET;
			}
			else
			{
				if( parse_context == CONTEXT_IN_ARRAY )
					console.log( ("(in array, got colon out of string):parsing fault; unexpected '%s' at %d  %d:%d"), c, pos.n, pos.line, pos.col );
				else
					console.log( ("(outside any object, got colon out of string):parsing fault; unexpected '%s' at %d  %d:%d"), c, pos.n, pos.line, pos.col );
				status = false;
			}
			break;
		case 125/*'}'*/:
			if(_DEBUG_PARSING) console.log( "close bracket context:", parse_context );
			// coming back after pushing an array or sub-object will reset the contxt to FIELD, so an end with a field should still push value.
			if( ( parse_context == CONTEXT_OBJECT_FIELD ) ) {
				if( _DEBUG_PARSING )
					console.log( "close object; empty object %d", val.value_type );				
				RESET_VAL();
				var old_context = context_stack.pop();
				if( _DEBUG_PARSING_STACK ) console.log( "object pop stack (close obj)", context_stack.length );
				parse_context = old_context.context; // this will restore as IN_ARRAY or OBJECT_FIELD
				elements = old_context.elements;
				element_array = old_context.element_array;
			}
			else if( ( parse_context == CONTEXT_OBJECT_FIELD_VALUE ) )
			{
				// first, add the last value
				if( _DEBUG_PARSING )
					console.log( "close object; push item '%s' %d", val.name, val.value_type );
				if( val.value_type != VALUE_UNSET ) {
					objectPush();
				}
				RESET_VAL();

				var old_context = context_stack.pop();
				if( _DEBUG_PARSING_STACK ) console.log( "object pop stack (close object)", context_stack.length );
				parse_context = old_context.context; // this will restore as IN_ARRAY or OBJECT_FIELD
				elements = old_context.elements;
				element_array = old_context.element_array;
			}
			else
			{
				console.log( ("Fault while parsing; unexpected '%s' at %d  %d:%d"), c, pos.n, pos.line, pos.col );
				status = false;
			}
			negative = false; 
			break;
		case 93/*']'*/:
			if( parse_context == CONTEXT_IN_ARRAY )
			{
				if( _DEBUG_PARSING )
				console.log( "close array, push last element: %d", val.value_type );
				if( val.value_type != VALUE_UNSET ) {
					//val.string = mOut;
					arrayPush();
				}
				RESET_VAL();
				{
					var old_context = context_stack.pop();
					if( _DEBUG_PARSING_STACK ) console.log( "object pop stack (close array)", context_stack.length );
					parse_context = old_context.context;
					elements = old_context.elements;
					element_array = old_context.element_array;
				}
			}
			else
			{
				console.log( ("bad context %d; fault while parsing; '%s' unexpected at %d  %d:%d") , parse_context, c, pos.n, pos.line, pos.col );// fault
				status = false;
			}
			negative = false; 
			break;
		case 44/*','*/:
			if(_DEBUG_PARSING) console.log( "comma context:", parse_context );
			if( parse_context == CONTEXT_IN_ARRAY )
			{
				if( val.value_type != VALUE_UNSET ) {
					if( _DEBUG_PARSING )
						console.log( "back in array; push item %d", val.value_type );
					arrayPush();
					RESET_VAL();
				}
				val.value_type = VALUE_UNDEFINED; // in an array, elements after a comma should init as undefined...
				// undefined allows [,,,] to be 4 values and [1,2,3,] to be 4 values with an undefined at end.
			}
			else if( parse_context == CONTEXT_OBJECT_FIELD_VALUE )
			{
				// after an array value, it will have returned to OBJECT_FIELD anyway	
				if( _DEBUG_PARSING )
					console.log( "comma after field value, push field to object: %s", val.name );
				parse_context = CONTEXT_OBJECT_FIELD;
				if( val.value_type != VALUE_UNSET ) {
					objectPush();
					RESET_VAL();
				}
			}
			else
			{
				status = false;
				console.log( ("bad context; fault while parsing; '%s' unexpected at %d  %d:%"), c, pos.n, pos.line, pos.col );// fault
			}
			negative = false; 
			break;

		default:
			if( parse_context == CONTEXT_OBJECT_FIELD ) {
				switch( cInt )
				{
				case 96://'`':
				case 34://'"':
				case 39://'\'':
					status = gatherString( );
					if(_DEBUG_PARSING) console.log( "string gather for object field name :", val.string );
					if( status ) { 
						val.value_type = VALUE_STRING;
					}
					break;
				case 10://'\n':
					pos.line++;
					pos.col = 1;
					// fall through to normal space handling - just updated line/col position
				case 32://' ':
				case 9://'\t':
				case 13://'\r':
				case 0xFEFF: // ZWNBS is WS though
					if( word == WORD_POS_RESET )
						break;
					else if( word == WORD_POS_FIELD ) {
						word = WORD_POS_AFTER_FIELD;
					}
					status = false;
					console.log( ("fault while parsing; whitespace unexpected at %d  %d:%d") , pos.n, pos.line, pos.col );	// fault
					// skip whitespace
					//n++;
					//console.log( "whitespace skip..." );
					break;
				default:
					if( word == WORD_POS_RESET ) {
						word = WORD_POS_FIELD;
					}
					val.string += c;
					break; // default
				}
								
			}
			else switch( cInt )
			{
			case 96://'`':
			case 34://'"':
			case 39://'\'':
				status = gatherString();
				if(_DEBUG_PARSING) console.log( "string gather for object field name :", val.string );
				if( status ) { val.value_type = VALUE_STRING; }
				break;

			case 10://'\n':
				pos.line++;
				pos.col = 1;
			case 32://' ':
			case 9://'\t':
			case 13://'\r':
			case 0xFEFF://'\uFEFF':
				if( word == WORD_POS_RESET )
					break;
				status = false;
				console.log( ("fault while parsing; whitespace unexpected at %d  %d:%d"), pos.n, pos.line, pos.col );	// fault
				break;

		//----------------------------------------------------------
		//  catch characters for true/false/null/undefined which are values outside of quotes
			case 116://'t':
				if( word == WORD_POS_RESET ) word = WORD_POS_TRUE_1;
				else if( word == WORD_POS_INFINITY_6 ) word = WORD_POS_INFINITY_7;
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 114://'r':
				if( word == WORD_POS_TRUE_1 ) word = WORD_POS_TRUE_2;
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 117://'u':
				if( word == WORD_POS_TRUE_2 ) word = WORD_POS_TRUE_3;
				else if( word == WORD_POS_NULL_1 ) word = WORD_POS_NULL_2;
				else if( word == WORD_POS_RESET ) word = WORD_POS_UNDEFINED_1;
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 101://'e':
				if( word == WORD_POS_TRUE_3 ) {
					val.value_type = VALUE_TRUE;
					word = WORD_POS_RESET;
				} else if( word == WORD_POS_FALSE_4 ) {
					val.value_type = VALUE_FALSE;
					word = WORD_POS_RESET;
				} else if( word == WORD_POS_UNDEFINED_3 ) word = WORD_POS_UNDEFINED_4;
				else if( word == WORD_POS_UNDEFINED_7 ) word = WORD_POS_UNDEFINED_8;
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 110://'n':
				if( word == WORD_POS_RESET ) word = WORD_POS_NULL_1;
				else if( word == WORD_POS_UNDEFINED_1 ) word = WORD_POS_UNDEFINED_2;
				else if( word == WORD_POS_UNDEFINED_6 ) word = WORD_POS_UNDEFINED_7;
				else if( word == WORD_POS_INFINITY_1 ) word = WORD_POS_INFINITY_2;
				else if( word == WORD_POS_INFINITY_4 ) word = WORD_POS_INFINITY_5;
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 100://'d':
				if( word == WORD_POS_UNDEFINED_2 ) word = WORD_POS_UNDEFINED_3;
				else if( word == WORD_POS_UNDEFINED_8 ) { val.value_type=VALUE_UNDEFINED; word = WORD_POS_RESET; }
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 105://'i':
				if( word == WORD_POS_UNDEFINED_5 ) word = WORD_POS_UNDEFINED_6;
				else if( word == WORD_POS_INFINITY_3 ) word = WORD_POS_INFINITY_4;
				else if( word == WORD_POS_INFINITY_5 ) word = WORD_POS_INFINITY_6;
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 108://'l':
				if( word == WORD_POS_NULL_2 ) word = WORD_POS_NULL_3;
				else if( word == WORD_POS_NULL_3 ) {
					val.value_type = VALUE_NULL;
					word = WORD_POS_RESET;
				} else if( word == WORD_POS_FALSE_2 ) word = WORD_POS_FALSE_3;
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 102://'f':
				if( word == WORD_POS_RESET ) word = WORD_POS_FALSE_1;
				else if( word == WORD_POS_UNDEFINED_4 ) word = WORD_POS_UNDEFINED_5;
				else if( word == WORD_POS_INFINITY_2 ) word = WORD_POS_INFINITY_3;
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 97://'a':
				if( word == WORD_POS_FALSE_1 ) word = WORD_POS_FALSE_2;
				else if( word == WORD_POS_NAN_1 ) word = WORD_POS_NAN_2;
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 115://'s':
				if( word == WORD_POS_FALSE_3 ) word = WORD_POS_FALSE_4;
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 73://'I':
				if( word == WORD_POS_RESET ) word = WORD_POS_INFINITY_1;
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 78://'N':
				if( word == WORD_POS_RESET ) word = WORD_POS_NAN_1;
				else if( word == WORD_POS_NAN_2 ) { val.value_type = negative ? VALUE_NEG_NAN : VALUE_NAN; word = WORD_POS_RESET; }
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
			case 121://'y':
				if( word == WORD_POS_INFINITY_7 ) { val.value_type = negative ? VALUE_NEG_INFINITY : VALUE_INFINITY; word = WORD_POS_RESET; }
				else { status = false; console.log( ("fault while parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col ); }// fault
				break;
		//
 	 	//----------------------------------------------------------
			case 45://'-':
				negative = !negative;
				break;

			default:
				if( ( cInt >= 48/*'0'*/ && cInt <= 57/*'9'*/ ) || ( cInt == 43/*'+'*/ ) )
				{
					let fromHex = false;
					// always reset this here....
					// keep it set to determine what sort of value is ready.

					val.string = c;  // terminate the string.
					let _n;
					while( (_n = pos.n),(( pos.n < msg_length ) && (c = msg.charAt(pos.n++)) ) )
					{
						let cInt = c.codePointAt(0);
						pos.col++;
						// leading zeros should be forbidden.
						if( ( cInt >= 48/*'0'*/ && cInt <= 57/*'9'*/ )
							|| ( c == '-' )
							|| ( c == '+' )
						  )
						{
							val.string += c;
						}
						else if( cInt == 120/*'x'*/ || cInt == 98/*'b'*/ ) {
							// hex conversion.
							if( !fromHex ) {
								fromHex = true;
								val.string += c;
							}
							else {
								status = false;
								console.log( ("fault wile parsing; '%s' unexpected at %d  %d:%d"), c, pos.n, pos.line, pos.col );
								break;
							}
						}
						else if( ( cInt ==101/*'e'*/ ) || ( cInt == 69/*'E'*/ ) || ( cInt == 46/*'.'*/ ) )
						{
							val.string += c;
						}
						else
						{
							break;
						}
					}
					pos.n = _n;
					val.negative = negative;
					val.value_type = VALUE_NUMBER;
				}
				else
				{
					// fault, illegal characer (whitespace?)
					status = false;
					console.log( ("fault parsing '%s' unexpected %d (near %*.*s[%s]%s)"), c, n
							 , ( (n>3)?3:n ), ( (n>3)?3:n )
							 , msg + n - ( (n>3)?3:n )
							 , c
							 , msg + n + 1
							 );// fault
				}
				break; // default
			}
			break; // default of high level switch
		}
	}

	{
		var old_context;
		while( old_context = context_stack.pop() ) {
			console.log( "warning unclosed contexts....", old_context );
		}
	}
	if( !status ) { throw new Error( "Parsing Error." ) };

	if( val.value_type != VALUE_UNSET ) {
		console.log( "Single value; unclosed, and pending, this should jsut result" );
		switch( val.value_type ) {
		case VALUE_NUMBER:
			return Number( val.string );
		case VALUE_STRING:
			return val.string;
		case VALUE_NULL:
			return null;
		case VALUE_UNDEFINED:
			return undefined;
		case VALUE_NAN:
			return NaN;
		case VALUE_NEG_NAN:
			return -NaN;
		case VALUE_INFINITY:
			return Infinity;
		case VALUE_NEG_INFINITY:
			return -Infinity;
		}
	}
	return result;
}


