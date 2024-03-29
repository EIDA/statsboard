// Code taken and modified from: https://github.com/aggregateknowledge/js-hll

module.exports = {
  HLL: HLL,
  fromHexString: fromHexString
};

// ** Config ***************************************************************
// default register width and number when loading explicit sets
var DEFAULT_REGISTER_WIDTH = 5/*schema v1*/,
    DEFAULT_LOG2M = 13/*schema v1*/;

// -------------------------------------------------------------------------
var LOWER = 0/*lower 32bits of the hashed value*/,
    UPPER = 1/*upper 32bits of the hashed value*/;

// ** Set Representation ***************************************************
/**
 * Creates a new HLL structure with the specified precision.
 *
 * @param {Number} [log2m=DEFAULT_LOG2M] the log-base-2 of the number of
 *        registers. This cannot be less than four or greater than 24.
 * @param {Number} [registerWidth=DEFAULT_REGISTER_WIDTH] the width in bits
 *        of the register values. This is <code>ceil(log2(log2(expectedUniqueElements)))</code>
 *        and cannot be less than one or greater than five.
 * @constructor
 */
// NOTE:  the register width is limited to at most 5 since that provides for
//        a maximum register value of 31 which is the limit of the JavaScript
//        bit shifting operators.
function HLL (log2m, registerWidth) {
    var self = {};

    if(arguments.length < 1) log2m = DEFAULT_LOG2M;
    if(arguments.length < 2) registerWidth = DEFAULT_REGISTER_WIDTH;
    if((log2m < 4) || (log2m > 24)) throw new Error("Register width must be between 4 and 24 inclusive (log2m = " + log2m + ").");
    if((registerWidth < 1) || (registerWidth > 5)) throw new Error("Register width must be between 1 and 5 inclusive (registerWidth = " + registerWidth + ").");

    // .. initialization ...................................................
    self.log2m = log2m;
    self.m = 1 << log2m/*for convenience*/;
    self.registerWidth = registerWidth;

    // NOTE:  there are two approaches that can be taken on storage:
    //        1.  Simply use an array of register values. This results in
    //            the easiest to read and maintain code but consumes considerably
    //            more memory than is necessary. (64bits are used for every
    //            register even though the register width is always less
    //            than or equal to 6.)
    //        2.  Use an ArrayBuffer to encode exactly '2^log2m * registerWidth'
    //            bits. This results in highly complex code to both read and
    //            maintain but is provides for optimal storage.
    //        Currently the first approach is taken.
    self.registers = [];
    for(var i=self.m-1; i>=0; i--) self.registers.push(0);

    // .. initialize meta values ...........................................
    // register count/width meta values
    var maxRegisterValue = ((1 << self.registerWidth/*2^registerWidth*/) - 1) >>> 0;
    var registerIndexMask = ((1 << log2m) - 1) >>> 0/*the mask applied to the lower-4bytes of the hashed value to get the register index*/;

    // cardinality estimation meta values
    var PW_BITS = maxRegisterValue - 1,
        L = PW_BITS + log2m,
        TWO_TO_L = Math.pow(2, L)/*L may be larger than 32 so '<<' cannot be used*/;

    var LARGE_ESTIMATOR_CUTOFF = (TWO_TO_L / 30),
        SMALL_ESTIMATOR_CUTOFF = 5 * self.registers.length/*m*/ / 2;

    var ALPHA_M_SQUARED = cardinalityAlphaMSquared(self.m);

    // =====================================================================
    function rho(value/*w*/) {
        // NOTE:  by contract the value must be 32bits (therefore only LOWER is needed)
        // NOTE: there are two approaches: mask "value" so that there are 1's
        //       in the upper bits or do a min. The former is more performant
        //       the latter is easier to read.
        var lsb = leastSignificantBit(value[LOWER]) + 1/*since 1-based*/;
        return Math.min(maxRegisterValue, lsb);
    };

    /**
     * @param {Array} a two element array that contains the upper- (index 1)
     *        and lower-32bit (index 0) bit values (of a 64bit hashed value)
     *        to be added to this set. This must be specified and cannot be
     *        null.
     * @returns {hll.HLL}
     */
    self.addRaw = function(hashValue) {
        var registerIndex = hashValue[LOWER] & registerIndexMask/*by contract <32bits so LOWER is sufficient*/;
        var registerValue = rho(shiftRightUnsignedLong(hashValue, log2m));
        self.registers[registerIndex] = Math.max(self.registers[registerIndex], registerValue);
    };

    // ---------------------------------------------------------------------
    /**
     * @returns {Number} the estimated cardinality of the set as a floating
     *          point number.
     * @see http://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf
     */
    self.algorithmCardinality = function() {
        var m = self.m/*for convenience*/;

        // compute the "indicator function" -- sum(2^(-M[j])) where M[j] is
        // the 'j'th register value
        var sum = 0.0;
        var numberOfZeroes = 0/*"V" in the paper*/;
        var registers = self.registers/*for performance*/;
        for(var j=m-1; j>=0; j--) {
            var registerValue = registers[j];

            sum += 1.0 / ((1 << registerValue/*2^registerValue*/)/*registerValue < 32 by contract*/ >>> 0)/*unsigned*/;
            if(registerValue == 0) numberOfZeroes++;
        }

        // apply the estimate and correction to the indicator function
        var estimator = ALPHA_M_SQUARED / sum;
        if((numberOfZeroes != 0) && (estimator < SMALL_ESTIMATOR_CUTOFF))
            return m * Math.log(m / numberOfZeroes);
        else if(estimator <= LARGE_ESTIMATOR_CUTOFF)
            return estimator;
        else
            return (-1 * TWO_TO_L) * Math.log(1.0 - (estimator / TWO_TO_L));
    };

    /**
     * @returns {Number} the estimated cardinality of the set <code>ceil</code>'d
     *          up to an integral number.
     * @see http://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf
     */
    self.cardinality = function() {
        return Math.ceil(self.algorithmCardinality());
    };

    // ---------------------------------------------------------------------
    /**
     * @return {Number} the standard error based on log2m (the number of registers)
     * @see http://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf
     */
    self.cardinalityError = function() {
        return 1.04 / Math.sqrt(1 << log2m/*2^log2m = m*/);
    };

    // =====================================================================
    /**
     * @param {hll.HLL} otherSet another HLL. <code>log2m</code> and <code>registerWidth</code>
     *        must be identical for the two sets otherwise an exception is
     *        thrown. This set is not modified in any way.
     * @returns {hll.HLL} the unioned results (which is this object).
     * @throws {Error} if the <code>log2m</code> and <code>registerWidth</code>
     *         of this set and the specified one do not match.
     */
    self.union = function(otherSet) {
        // NOTE:  currently precluding unioning with different sized sets
        if((self.log2m != otherSet.log2m) || (self.registerWidth != otherSet.registerWidth)) throw new Error("Union of sets with different 'log2m' " + ((self.log2m == otherSet.log2m) ? "" : "(" + self.log2m + " != " + otherSet.log2m + ") ") + "or 'registerWidth'" + ((self.registerWidth == otherSet.registerWidth) ? "" : " (" + self.registerWidth + " != " + otherSet.registerWidth + ")") + ".");

        var selfRegisterCount = self.m,
            otherRegisterCount = otherSet.m;
        var registerCount = Math.min(selfRegisterCount, otherRegisterCount);

    // TODO:  re-incorporate when contract updated
    // TODO:  don't change 'otherSet' since it's not in the contract. Make a clone.
    //            // 'fold' the larger set until it is the same size as this set
    //            var largerSet = selfRegisterCount > otherRegisterCount ? self : otherSet;
    //            while(largerSet.registers.length != registerCount)
    //                largerSet.fold();

        var selfRegisters = self.registers/*for performance*/,
            otherRegisters = otherSet.registers/*for performance*/;
        for(var i=registerCount-1; i>=0; i--)
            selfRegisters[i] = Math.max(selfRegisters[i], otherRegisters[i]);

        return self;
    };

    /**
     * 'Folds' a set down to the specified <code>log2m</code> as per
     * {@link http://blog.aggregateknowledge.com/2012/09/12/set-operations-on-hlls-of-different-sizes/}.
     *
     * @param {Number} the desired <code>log2m</code> (which determines the
     *        relative error) of the HLL. This cannot be less than one or
     *        greater than the current value.
     * @returns {hll.HLL} a duplicate of this set, folded to match the specified
     *          <code>log2m</code>. The current set is left untouched.
     * @throws {Error} if the specified <code>log2m</code> is less than two
     *         or greater than the current value.
     */
    self.fold = function(log2m) {
        if(log2m == self.log2m) return self.clone()/*trivial case -- by contract it must be a duplicate*/;
        if((log2m < 1) || (log2m > self.log2m)) throw new Error("'log2m' cannot be less than 1 or greater than the current value.");

        // assume log2m=6 and registerWidth=5. Then there will be 6bits that
        // compose the index (I) and at most '2^5 - 1 = 31' bits that compose
        // the register value (V):
        //    0b ---- ---- ---V VVVV  VVVV VVVV VVVV VVVV  VVVV VVVV VVII IIII
        // Folding by one (log2m=6 -> log2m=5) means that one bit that was
        // previously in the index is now part of the register value:
        //    0b ---- ---- ---- VVVV  VVVV VVVV VVVV VVVV  VVVV VVVV VvVI IIII
        // (shown as a lower case 'v' to make it clear). Since the HLL
        // algorithm uses the least-significant set bit ('1') of the register
        // value, there are two possible cases:
        // 1.  The upper bit of the old index (which is now the lower bit
        //     of the register value) was set to '1' in which case the new
        //     register value is '1';
        // 2.  The upper bit of the old index was set to '0' in which case
        //     the new register value is 'min(oldRegisterValue + 1, 31)';
        // Case #1 means that the upper half of the registers can be ignored
        // since the *maximum* register value of case #1 is '1' where as the
        // *minimum* register value in case #2 is '1'.
        // This can be easily extended to folding 'n' times.
        // SEE:  http://blog.aggregateknowledge.com/2013/03/25/hyperloglog-engineering-choosing-the-right-bits/
        // NOTE:  since 'registerWidth' does not change the same 'maxRegisterValue'
        //        is to be used
        var hllSet = new HLL(log2m, self.registerWidth);
        var foldedRegisters = hllSet.registers/*for performance*/,
            selfRegisters = self.registers/*for performance*/;
        var difference = self.log2m - log2m,
            foldedM = hllSet.m/*by definition*/;
        for(var i=foldedM-1; i>=0; i--)
            foldedRegisters[i] = Math.min(selfRegisters[i] + difference, maxRegisterValue)/*bound above by 'maxRegisterValue'*/;

        return hllSet;
    };

    // =====================================================================
    /**
     * @returns {hll.HLL} a clone of this set (with no remaining references
     *          to the original set.
     */
    self.clone = function() {
        var clone = new HLL(self.log2m, self.registerWidth);
        // copy all registers
        var selfRegisters = self.registers/*for performance*/,
            cloneRegisters = clone.registers/*for performance*/;
        for(var i=self.m-1; i>=0; i--)
            cloneRegisters[i] = selfRegisters[i];

        return clone;
    };

    /**
     * @returns {hll.HLL} this object with all of its register values set
     *          to zero.
     */
    self.clear = function() {
        var registers = self.registers/*for performance*/;
        for(var i=self.m-1; i>=0; i--)
            registers[i] = 0/*clear*/;

        return self;
    };

    // =====================================================================
    /**
     * Encodes this structure into a hexadecimal string in the format
     * described in <code>STORAGE.markdown</code> schema version 1. Only
     * <tt>FULL</tt> representations are supported.
     *
     * @return {String} the string that encodes this HLL structure
     */
    self.toHexString = function() {
        // byte layout VPCB*'
        var writer = new ByteWriter();

        // version byte: schema 1, full
        writer.addBits(0x14, 8);
        // parameter byte:
        // *  top 3 bits: registerWidth - 1
        // *  bottom 5 bits: log2m
        writer.addBits(registerWidth - 1, 3);
        writer.addBits(log2m, 5);
        // cutoff byte
        writer.addBits(0, 8)/*1 bit of padding, explicit enabled = 0, explicit cuttoff = 0*/;

        // The data bytes encode the register values in 'registerWidth'-bit-wide
        // "short words". The words are stored in _ascending_ index order

        // If 'BITS = registerWidth * numberOfRegisters' is not divisible by
        // 8, then 'BITS % 8' padding bits are added to the _bottom_ of the
        // _last_ byte of the array

        // The short words are written from the top of the zero-th byte of
        // the array to the bottom of the last byte of the array, with the
        // high bits of the short words toward the high bits of the byte.

        var m = self.m/*for performance*/;
        var registers = self.registers/*for performance*/;
        for(var i=0; i<m; i++) /*NOTE: iteration order matters*/
            writer.addBits(registers[i], registerWidth);
        // NOTE:  ByteWriter automatically has padding to fit evenly into a byte

        return hexfromByteArray(writer.getBytes());
    };

    return self;
};


// =========================================================================
/**
 * @param {Number} m must be a power of two, cannot be less than 16
 *        (2<sup>4</sup>), and cannot be greater than 65536 (2<sup>16</sup>).
 * @returns {Number} gamma times <code>m</code> squared where gamma is based
 *          on the value of <code>m</code>
 * @throws {Error} if <code>m</code> is less than 16
 */
function cardinalityAlphaMSquared(m) {
    switch(m) {
        case 1/*2^0*/:
        case 2/*2^1*/:
        case 4/*2^2*/:
        case 8/*2^3*/:
            throw new Error("'m' cannot be less than 16 (" + m + " < 16).");

        case 16/*2^4*/:
            return 0.673 * m * m;

        case 32/*2^5*/:
            return 0.697 * m * m;

        case 64/*2^6*/:
            return 0.709 * m * m;

        default/*>2^6*/:
            return (0.7213 / (1.0 + 1.079 / m)) * m * m;
    }
}

// ** Parsing **************************************************************
// number of bits in a byte
var BITS_IN_BYTE = 8;

// schema version constants
var SCHEMA1 = 1;

// algorithm constants
var algorithm = {
    EMPTY: "Empty",
    EXPLICIT: "Explicit",
    SPARSE: "Sparse",
    FULL: "Full",
    UNDEFINED: "Undefined"
};

// schema version 1 algorithm indexes
var schema1 = {
    UNDEFINED : 0,
    EMPTY : 1,
    EXPLICIT : 2,
    SPARSE : 3,
    FULL : 4
};

// =========================================================================
/**
 * Decodes an HLL encoded in the specified hexadecimal string as defined by
 * <code>STORAGE.markdown</code>.
 *
 * @param {String} string the string to decode
 * @returns {{hllSet: hll.HLL, version: Number, algorithm: String}}
 *          <code>set</code> the HLL object loaded from the hex string.
 *          <code>version</code> the schema version number.
 *          <code>algorithm</code> the name of the encoding {@link hll.algorithm algorithm}.
 */
function fromHexString (string) {
    var arrayBuffer = hexToArrayBuffer(string);
    return parseSet(arrayBuffer);
};

/**
 * @param  {ByteArray} arrayBuffer an encoded HLL as defined by <code>STORAGE.markdown</code>.
 * @returns {{hllSet: hll.HLL, version: Number, algorithm: String}}
 *          <code>hllSet</code> the HLL object loaded from the hex string.
 *          <code>version</code> the schema version number.
 *          <code>algorithm</code> the name of the encoding {@link hll.algorithm algorithm}.
 */
var parseSet = function(arrayBuffer) {
    // SEE: STORAGE.markdown

    // byte array format: V*
    var bytes = new Uint8Array(arrayBuffer);

    // the schema value is stored in the upper nibble of the version byte,
    // while the algorithm version is stored in the lower nibble of that byte
    var version = upperNibble(bytes[0/*V*/]),
        algorithm = lowerNibble(bytes[0/*V*/]);

    if(version == SCHEMA1) {
        switch(algorithm) {
            case schema1.UNDEFINED:
                return { hllSet: schema1_empty(arrayBuffer), version: version, algorithm: algorithm.UNDEFINED };
            case schema1.EMPTY:
                return { hllSet: schema1_empty(arrayBuffer), version: version, algorithm: algorithm.EMPTY };
            case schema1.EXPLICIT:
                return { hllSet: schema1_explicit(arrayBuffer), version: version, algorithm: algorithm.EXPLICIT };
            case schema1.SPARSE:
                return { hllSet: schema1_sparse(arrayBuffer), version: version, algorithm: algorithm.SPARSE };
            case schema1.FULL:
                return { hllSet: schema1_full(arrayBuffer), version: version, algorithm: algorithm.FULL };
            default:
                throw new Error("Unknown schema version 1 algorithm (index): " + algorithm);
        }
    } else /*unknown*/
        throw new Error("Unknown schema version: " + version);
};

// == Schema v1 ============================================================
// @param {Number} parameterByte the parameter byte that is to be parsed
// @returns {{ log2m: Number, registerWidth: Number }} the parsed register
//          width and log2m
function schema1_parameters(parameterByte) {
    // highest 3 bits encode the value 'registerWidth - 1' and the remaining
    // 5 bits encode 'log2m'
    return { registerWidth: getBitSequenceFromByte(parameterByte, 0, 3) + 1,
             log2m: getBitSequenceFromByte(parameterByte, 3, 5) };
}
// @param {ArrayBuffer} arrayBuffer array buffer encoding a schema v1 'FULL'
// @returns {hll.HLL} a new HLL decoded from the <code>ArrayBuffer</code>
function schema1_full(arrayBuffer) {
    // byte array format: VPCB*
    var bytes = new Uint8Array(arrayBuffer);

    var parameters = schema1_parameters(bytes[1/*P*/]);
    var registerWidth = parameters.registerWidth/*for convenience*/,
        log2m = parameters.log2m/*for convenience*/,
        m = 1 << log2m/*2^log2m*/;

    // the values are stored in 'registerWidth' bit wide ascending sequence
    var registers = [];
    var byteOffset = 3 * BITS_IN_BYTE/*VPC*/;
    for(var i=m-1; i>=0; i--) {
        registers.push(getBitSequenceValueFromByteArray(bytes, byteOffset, registerWidth));
        byteOffset += registerWidth;
    }

    var hllSet = new HLL(log2m, registerWidth);
        hllSet.registers = registers;
    return hllSet;
}
// @param {ArrayBuffer} arrayBuffer array buffer encoding a schema v1 'SPARSE'
// @returns {hll.HLL} a new HLL decoded from the <code>ArrayBuffer</code>
function schema1_sparse(arrayBuffer) {
    // byte array format: VPCB*
    var bytes = new Uint8Array(arrayBuffer);
    return common_sparse(arrayBuffer, 3/*VPC*/, schema1_parameters(bytes[1/*P*/]));
}
// @param {ArrayBuffer} arrayBuffer array buffer encoding a schema v1 'EMPTY'
// @returns {hll.HLL} a new HLL decoded from the <code>ArrayBuffer</code>
function schema1_empty(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    return common_empty(schema1_parameters(bytes[1/*P*/]));
}
// @param {ArrayBuffer} arrayBuffer array buffer encoding a schema v1 'EXPLICIT'
// @returns {hll.HLL} a new HLL decoded from the <code>ArrayBuffer</code>
function schema1_explicit(arrayBuffer) {
    // byte array format: VPCB{8}*
    var bytes = new Uint8Array(arrayBuffer);
    return common_explicit(arrayBuffer, 3/*VPC*/, schema1_parameters(bytes[1/*P*/]));
}

// == Decoding Common ======================================================
// @param {{ log2m: Number, registerWidth: Number }} parameters the register
//        width and log2m parameters
// @returns {hll.HLL} a new HLL with the specified parameters
function common_empty(parameters) {
    return new HLL(parameters.log2m, parameters.registerWidth);
}

// @param {ArrayBuffer} arrayBuffer array buffer encoding an 'EXPLICIT' set
// @param {Number} offset the offset in the array buffer to the data bytes
// @param {{ log2m: Number, registerWidth: Number }} parameters the register
//        width and log2m parameters
// @returns {hll.HLL} a new HLL decoded from the <code>ArrayBuffer</code>
function common_explicit(arrayBuffer, offset, parameters) {
    var hllSet = new HLL(parameters.log2m, parameters.registerWidth);

    // Each block of 8 bytes represent a signed 64-bit integer (sign bit +
    // 63 value bits). These integers are encoded as big-endian (with sign-bit
    // at highest position), and are the "contents" of the multiset.
    var bytes = new Uint8Array(arrayBuffer);
    var byteOffset = offset;
    while(byteOffset < bytes.length) {
        // load the tuple from the byte array at the given offset
        var value = extractLong(bytes, byteOffset);
        hllSet.addRaw(value);

        // move forward 8 bytes to the next value;
        byteOffset += 8/*bytes in 'long'*/;
    }

    return hllSet;
}

// @param {ArrayBuffer} arrayBuffer array buffer encoding an 'EXPLICIT' set
// @param {Number} offset the offset in the byte array to the data bytes
// @param {{ log2m: Number, registerWidth: Number }} parameters the register
//        width and log2m parameters
// @returns {hll.HLL} a new HLL decoded from the <code>ArrayBuffer</code>
function common_sparse(arrayBuffer, offset, parameters) {
    var registerWidth = parameters.registerWidth/*for convenience*/,
        log2m = parameters.log2m/*for convenience*/,
        m = 1 << log2m/*2^log2m*/;

    var registers = [];
    for(var i=m-1; i>=0; i--) registers.push(0/*initialize*/);

    // If 'BITS = registerWidth * m' is not divisible by 8, then 'BITS % 8'
    // padding bits are added to top of the first byte of the array account
    // for this padding
    var bitOffset = offset * BITS_IN_BYTE/*after offset*/;
        bitOffset += (m * registerWidth) % BITS_IN_BYTE;

    var bytes = new Uint8Array(arrayBuffer);
    var registerCount = Math.floor(((bytes.length - offset)/*data bytes*/ * BITS_IN_BYTE) / (log2m + registerWidth));
    for(var i=registerCount-1; i>=0; i--) {
        var key = getBitSequenceValueFromByteArray(bytes, bitOffset, log2m);
        bitOffset += log2m;
        var value = getBitSequenceValueFromByteArray(bytes, bitOffset, registerWidth);
        bitOffset += registerWidth;

        registers[key] = value;
    }

    var hllSet = new HLL(log2m, registerWidth);
        hllSet.registers = registers;
    return hllSet;
}

/**
 * @fileoverview Utility functions for manipulating bit and byte values in
 * JavaScript. In general there are a few points to remember when working with
 * JavaScript and bit operations:
 * <ul>
 *   <li>JavaScript operates on 32 bits when performing bitwise operations. See:
 *       {@link https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Operators/Bitwise_Operators}</li>
 *   <li><tt>value >>> 0</tt> makes the number unsigned</li>
 *   <li>Only 56bits of precision are supported in integers so 'long's are
 *       supported by using two 32bit words</li>
 * </ul>
 */

// *************************************************************************
var BITS_IN_BYTE = 8;

// -------------------------------------------------------------------------
var LOWER = 0/*lower 32bits of a 'long' value*/,
    UPPER = 1/*upper 32bits of a 'long' value*/;

// *************************************************************************
/**
 * @param {Array} a two element array that contains the upper- (index 1)
 *        and lower-32bit (index 0) bit values of a 64bit value.
 * @param {Number} the number of bits to be shifted right. If negative or
 *        greater than 63 then it is made positive or bounded to [0, 63]
 * @returns {Array} the specified long value shifted right by the specified
 *          amount with the left-padded bits matching that of the sign bit.
 */
function shiftRightLong (longValue, shift) {
    shift &= 63/*by contract*/;
    if(shift == 0) return longValue/*nothing to do*/;

    var upper = longValue[UPPER]/*for convenience*/;
    if(shift < 32) {
        var lower = longValue[LOWER]/*for convenience*/;
        return [ ((lower >>> shift) | (upper << (32 - shift))),
                 (upper >> shift) ];
    } else { /*shift >= 32*/
        return [ (upper >> (shift - 32)),
                 (upper >= 0 ? 0 : -1) ];
    }
};

/**
 * @param {Array} a two element array that contains the upper- (index 1)
 *        and lower-32bit (index 0) bit values of a 64bit value.
 * @param {Number} the number of bits to be shifted right. If negative or
 *        greater than 63 then it is made positive or bounded to [0, 63]
 * @returns {Array} the specified long value shifted right by the specified
 *          amount with the left-padded bits set to zero.
 */
function shiftRightUnsignedLong (longValue, shift) {
    shift &= 63/*by contract*/;
    if(shift == 0) return longValue/*nothing to do*/;

    var upper = longValue[UPPER]/*for convenience*/;
    if(shift < 32) {
        var lower = longValue[LOWER]/*for convenience*/;
        return [ ((lower >>> shift) | (upper << (32 - shift))),
                 (upper >>> shift) ];
    } else if(shift == 32)
      return [ upper, 0/*clear upper*/ ];
    else /*shift > 32*/
      return [ (upper >>> (shift - 32)), 0/*clear upper*/ ];
};

// -------------------------------------------------------------------------
/**
 * Load a long (64bit) integer from the given byte array, starting from the
 * given byte position.
 *
 * @param {Array} bytes array of bytes, with long values packed from the 0th
 *        byte in 8 byte intervals. Long values are stored big endian.
 * @param {Number} startByteIndex index into the array to the upper byte of
 *        the long value
 * @returns {Array} a two element array that contains the upper- (index 1)
 *          and lower-32bit (index 0) bit values of the extracted 64bit value.
 */
function extractLong (bytes, startByteIndex) {
    var lower = 0,
        upper = 0;

    // load 8 bytes, big endian order
    upper |= bytes[startByteIndex    ] << 24;
    upper |= bytes[startByteIndex + 1] << 16;
    upper |= bytes[startByteIndex + 2] <<  8;
    upper |= bytes[startByteIndex + 3];
    lower |= bytes[startByteIndex + 4] << 24;
    lower |= bytes[startByteIndex + 5] << 16;
    lower |= bytes[startByteIndex + 6] <<  8;
    lower |= bytes[startByteIndex + 7];

    return [ lower >>> 0, upper >>> 0 ];
};

// =========================================================================
/**
 * @param {Number} byteValue a byte
 * @returns {Number} the upper nibble (4bits) of that byte
 */
function upperNibble (byteValue) {
    return byteValue >> 4;
};

/**
 * @param {Number} byteValue a byte
 * @returns {Number} the lower nibble (4bits) of that byte
 */
function lowerNibble (byteValue) {
    return byteValue & 0x0F;
};

// =========================================================================
/**
 * Decodes an array of bytes from a hex string.
 *
 * @param {String} hex string of hex digits, starts with two characters to
 *         be discarded "\x", "0x", or similar, the number of hex digits
 *         must be an even number, come out to a round number of bytes
 * @returns {ArrayBuffer} an <code>ArrayBuffer</code> of values representing
 *          the bytes encoded in the hex string
 */
 function hexToArrayBuffer (hex) {
    hex = hex.substring(2/*discard the first two characters "0x, \x"*/);
    var length = hex.length / 2/*each hex digit is 4bits, or 1/2 byte*/;
    // allocate the byte array of the correct size.
    var arrayBuffer = new ArrayBuffer(length);
    var byteView = new Uint8Array(arrayBuffer);

    for(var i=0; i<length; i++) {
        // parse two hex digits into a byte
        var byteString = hex[i * 2] + hex[i * 2 + 1];
        byteView[i] = parseInt(byteString, 16);
    }

    return arrayBuffer;
};

/**
 * Encodes a hex string from an array of bytes.
 *
 * @param {Array} bytes the bytes to encode
 * @returns {String} the encoded hex string which will start with '/x'
 */
 function hexfromByteArray (bytes) {
    var hex = "/x";
    for(var i=0; i<bytes.length; i++) {
        var byteValue = bytes[i];
        hex += (byteValue < 0x10 ? "0" : ""/*ensure 2 digits per byte*/) + byteValue.toString(16);
    }
    return hex;
};

// =========================================================================
/**
 * @param {Number} byteValue a byte
 * @param {Number} start the bit index starting from the top-bit
 * @param {Number} length the number of bits to include in the sequence
 * @returns {Number} unsigned integer representing the bits from <code>start</code>
 *          to <code>start + length</code> in the value
 */
function getBitSequenceFromByte (byteValue, start, length) {
    return (byteValue >>> (BITS_IN_BYTE - (start + length))) &
               ((1 << length) - 1)/*mask of width 'length'*/;
};

// -------------------------------------------------------------------------
/**
 * Retrieves the value of the integer between the given start and end bit
 * indexes from an array of bytes in big-endian order.
 *
 * @param {Array} bytes the byte array from which the number is read
 * @param {Number} start the index of the start of the bit sequence
 * @param {Number} length the length of the sequence of bits. This must be
 *        less than 32.
 * @returns {Number} the value of the specified sequence of bits
 */
// TODO:  this can use some consistency clean-up
function getBitSequenceValueFromByteArray (bytes, start, length) {
    // determine the start and end byte and bit indices of the requested bit sequence
    var byteStartIndex = start >>> 3/*divide by BITS_IN_BYTE*/;
    var byteEndIndex = (start + length) >>> 3/*divide by BITS_IN_BYTE*/;
    var bitStartIndex = start & 0x07/*% BITS_IN_BYTE*/;

    // if the value exists within a single byte, simply grab that value out of
    // the single byte
    if(byteStartIndex == byteEndIndex) return getBitSequenceFromByte(bytes[byteEndIndex], bitStartIndex, length);

    var bitEndIndex = (start + length) & 0x07/*% BITS_IN_BYTE*/;

    // iterate through the byte array from the end byte index to the start
    // byte index, accumulating the value.
    var result = 0;
    var shift = 0;
    for(var i=byteEndIndex; i>=byteStartIndex; i--) {
        var byteValue;
        if(i == byteStartIndex)
            byteValue = getBitSequenceFromByte(bytes[i], bitStartIndex, BITS_IN_BYTE - bitStartIndex);
        else if(i == byteEndIndex)
            byteValue = getBitSequenceFromByte(bytes[i], 0, bitEndIndex);
        else /*use the entire byte, if it is not the start or end bytes*/
            byteValue = bytes[i];

        result |= byteValue << shift;

        if(i == byteEndIndex)
            shift += bitEndIndex;
        else
            shift += BITS_IN_BYTE;
    }

    return result;
};

// =========================================================================
// least significant bit
// REF:  http://stackoverflow.com/questions/757059/position-of-least-significant-bit-that-is-set
// REF:  http://www-graphics.stanford.edu/~seander/bithacks.html
var LEAST_SIGNIFICANT_BIT = [/*0-based*/
    -1, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     7, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
     4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0
];
/**
 * @param {Number} value a 32bit value for which the least-significant bit
 *        set is desired. This cannot be null, greater than 32bits, or unspecified.
 * @returns {Number} the 0-based position of the least-significant bit set.
 */
function leastSignificantBit (value) {
    if(value == 0) return -1/*by contract*/;
    if((value & 0x0000FF) != 0) return LEAST_SIGNIFICANT_BIT[( (value >>>  0) & 0xFF)] +  0;
    if((value & 0x00FFFF) != 0) return LEAST_SIGNIFICANT_BIT[( (value >>>  8) & 0xFF)] +  8;
    if((value & 0xFFFFFF) != 0) return LEAST_SIGNIFICANT_BIT[( (value >>> 16) & 0xFF)] + 16;
    return LEAST_SIGNIFICANT_BIT[( (value >>> 24) & 0xFF)] + 24;
};

// *************************************************************************
/**
 * Creates a new mechanism for writing data into a byte array.
 * @constructor
 */
function ByteWriter () {
    var self = this;

    var currentByte = 0;
    var bytes = [];
    var remainingBitsInByteCount = BITS_IN_BYTE;

    // ---------------------------------------------------------------------
    /**
     * Write bits to the tail end of the byte array writing from the upper
     * bits of each byte.
     *
     * @param {Number} value the value to add to the byte array
     * @param {Number} bitCount number of bits starting from the lower bits
     *         of the value to add to the byte array, at most 32 bits
     */
    self.addBits = function(value, bitCount) {
        var remainingBitsInValueCount = bitCount;
        while(remainingBitsInValueCount > 0) {
            // the value is taken from the lower bits of 'value' but read
            // starting from the upper bit(s)
            var writeBitCount = Math.min(remainingBitsInValueCount, remainingBitsInByteCount);
            var writeValue = ((value >>> (remainingBitsInValueCount - writeBitCount)) &
                              ((1 << writeBitCount) - 1)/*mask of width 'writeBitCount'*/) >>> 0;

            // writing starts at the upper bit(s)
            currentByte |= (writeValue << (remainingBitsInByteCount - writeBitCount));

            remainingBitsInValueCount -= writeBitCount;
            remainingBitsInByteCount -= writeBitCount;
            if(remainingBitsInByteCount <= 0) {
                bytes.push(currentByte);
                currentByte = 0/*clear*/;
                remainingBitsInByteCount = BITS_IN_BYTE/*reset*/;
            } /* else -- not a full byte yet */
        }
    };

    /**
     * @returns {Array} the bytes that have been {@link #addBits() added}
     *          to this writer. Modifying this array will modify the internal
     *          storage.
     */
    self.getBytes = function() {
        if(remainingBitsInByteCount < BITS_IN_BYTE) { /*bits in currentByte haven't been added to bytes yet*/
            var copyBytes = bytes.slice(0)/*clone*/;
                copyBytes.push(currentByte);
            return copyBytes;
        } else/*no addition bits have been added*/
            return bytes;
    };
};
