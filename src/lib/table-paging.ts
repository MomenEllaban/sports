/**
 * One page size for every table in the product.
 *
 * The tables previously disagreed with each other: 6, 8, 10, 20, 24, 25, 30,
 * 50, 100, 150 and 200 rows all appeared somewhere, and 28 of them had no
 * pager at all. A dashboard user switching between sections saw the same list
 * change shape every time, which reads as a bug even when nothing is wrong.
 *
 * Eight is deliberate rather than a round default: it is the largest page that
 * still fits a laptop viewport without the header row scrolling out of sight,
 * so the header stays attached to the data while you read.
 *
 * Imported by server pages for `skip`/`take` and by client tables for slicing,
 * so a page can never paginate the database at 8 and then render 20 of them.
 */
export const TABLE_PAGE_SIZE = 8;
