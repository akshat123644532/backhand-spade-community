/**
 * Run async work with a maximum number of concurrent operations.
 *
 * @param {Array} items
 * @param {number} concurrency
 * @param {Function} worker
 * @returns {Promise<Array>}
 */
export const runWithConcurrency = async (
    items,
    concurrency,
    worker
) => {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    if (!Number.isInteger(concurrency) || concurrency <= 0) {
        throw new Error(
            'Concurrency must be a positive integer.'
        );
    }

    const results = new Array(items.length);

    let currentIndex = 0;

    const runWorker = async () => {
        while (true) {
            const index = currentIndex++;

            if (index >= items.length) {
                return;
            }

            try {
                results[index] =
                    await worker(
                        items[index],
                        index
                    );
            } catch (error) {
                results[index] = {
                    success: false,
                    error
                };
            }
        }
    };

    const workerCount = Math.min(
        concurrency,
        items.length
    );

    await Promise.all(
        Array.from(
            { length: workerCount },
            () => runWorker()
        )
    );

    return results;
};