import { purry } from './purry';
import type { NonEmptyArray } from './_types';

const ALL_DIRECTIONS = ['asc', 'desc'] as const;
type Direction = (typeof ALL_DIRECTIONS)[number];

type SortProjection<T> = (x: T) => Comparable;
type ComparablePrimitive = number | string | boolean;
type Comparable = ComparablePrimitive | { valueOf(): ComparablePrimitive };
type SortPair<T> = readonly [SortProjection<T>, Direction];
type SortRule<T> = SortProjection<T> | SortPair<T>;

const ASCENDING_COMPARATOR = <T>(x: T, y: T) => x > y;
const DESCENDING_COMPARATOR = <T>(x: T, y: T) => x < y;

/**
 * Sorts the list according to the supplied functions and directions.
 * Sorting is based on a native `sort` function. It's not guaranteed to be stable.
 *
 * Directions are applied to functions in order and default to ascending if not specified.
 * @param sort first sort rule
 * @param sorts additional sort rules
 * @signature
 *    R.sortBy(...sorts)(array)
 * @example
 *    R.pipe(
 *      [{ a: 1 }, { a: 3 }, { a: 7 }, { a: 2 }],
 *      R.sortBy(x => x.a)
 *    ) // => [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 7 }]
 * @data_last
 * @category Array
 */
export function sortBy<T>(
  sort: SortRule<T>,
  ...sorts: Array<SortRule<T>>
): (array: ReadonlyArray<T>) => Array<T>;

/**
 * Sorts the list according to the supplied functions and directions.
 * Sorting is based on a native `sort` function. It's not guaranteed to be stable.
 *
 * Directions are applied to functions in order and default to ascending if not specified.
 * @param array the array to sort
 * @param sorts a list of mapping functions and optional directions
 * @signature
 *    R.sortBy(array, ...sorts)
 * @example
 *    R.sortBy(
 *      [{ a: 1 }, { a: 3 }, { a: 7 }, { a: 2 }],
 *      x => x.a
 *    )
 *    // => [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 7 }]
 *
 *    R.sortBy(
 *     [
 *       {color: 'red', weight: 2},
 *       {color: 'blue', weight: 3},
 *       {color: 'green', weight: 1},
 *       {color: 'purple', weight: 1},
 *     ],
 *      [x => x.weight, 'asc'], x => x.color
 *    )
 *    // =>
 *    //   {color: 'purple', weight: 1},
 *    //   {color: 'green', weight: 1},
 *    //   {color: 'red', weight: 2},
 *    //   {color: 'blue', weight: 3},
 * @data_first
 * @category Array
 */
export function sortBy<T>(
  array: ReadonlyArray<T>,
  ...sorts: Array<SortRule<T>>
): Array<T>;

export function sortBy<T>(
  arrayOrSort: ReadonlyArray<T> | SortRule<T>,
  ...sorts: Array<SortRule<T>>
): unknown {
  const args = isSortRule(arrayOrSort)
    ? [[arrayOrSort, ...sorts]]
    : [arrayOrSort, sorts];

  return purry(_sortBy, args);
}

function isSortRule<T>(x: ReadonlyArray<T> | SortRule<T>): x is SortRule<T> {
  if (typeof x === 'function') {
    // must be a SortProjection
    return true;
  }

  const [maybeProjection, maybeDirection, ...rest] = x;

  if (rest.length > 0) {
    // Not a SortPair if we have more stuff in the array
    return false;
  }

  return (
    typeof maybeProjection === 'function' &&
    // eslint-disable-next-line @typescript-eslint/prefer-includes -- we use an old lib
    ALL_DIRECTIONS.indexOf(maybeDirection as Direction) !== -1
  );
}

const _sortBy = <T>(
  array: ReadonlyArray<T>,
  sorts: Readonly<NonEmptyArray<SortRule<T>>>
): Array<T> =>
  // Sort is done in-place so we need to copy the array.
  [...array].sort(comparer(...sorts));

function comparer<T>(
  primaryRule: SortRule<T>,
  secondaryRule?: SortRule<T>,
  ...otherRules: ReadonlyArray<SortRule<T>>
): (a: T, b: T) => number {
  const [projector, direction] =
    typeof primaryRule === 'function'
      ? [primaryRule, 'asc' as const]
      : primaryRule;

  const comparator = directionComparator(direction);

  const nextComparer =
    secondaryRule === undefined
      ? undefined
      : comparer(secondaryRule, ...otherRules);

  return (a, b) => {
    const projectedA = projector(a);
    const projectedB = projector(b);

    if (comparator(projectedA, projectedB)) {
      return 1;
    }

    if (comparator(projectedB, projectedA)) {
      return -1;
    }

    // The elements are equal base on the current comparator and projection. So
    // we need to check the elements using the next comparer, if one exists,
    // otherwise we consider them as true equal (returning 0).
    return nextComparer?.(a, b) ?? 0;
  };
}

function directionComparator(direction: Direction): <T>(a: T, b: T) => boolean {
  // We use a switch here just to make sure we are tightly coupled with
  // Direction
  switch (direction) {
    case 'asc':
      return ASCENDING_COMPARATOR;
    case 'desc':
      return DESCENDING_COMPARATOR;
  }
}
