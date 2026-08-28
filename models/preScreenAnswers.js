import { db } from '../config/db.js';

const TABLE = 'survey_prescreen_answer';

const surveyPreScreenAnswers = {

    createOrUpdateAnswer: async ({
        survey_prescreen_response_id,
        question_id,
        question_text,
        question_type,
        answer
    }) => {

        const [result] = await db.execute(
            `INSERT INTO \`${TABLE}\`
                (
                    survey_prescreen_response_id,
                    question_id,
                    question_text,
                    question_type,
                    answer,
                    created_at
                )
             VALUES (?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                question_text = VALUES(question_text),
                question_type = VALUES(question_type),
                answer = VALUES(answer)`,
            [
                survey_prescreen_response_id,
                question_id,
                question_text,
                question_type,
                answer
            ]
        );

        return result;
    },

};


export default surveyPreScreenAnswers;