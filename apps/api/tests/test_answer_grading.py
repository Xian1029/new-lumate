import asyncio

from services.practice.grading_service import MatchType, grade_answer, grade_answer_deterministic


REFERENCE = "李明增长 1.2kg，张华增长 -0.5kg，刘伟增长 0kg。其中 1.2kg 和 0kg 是非负数。"
EQUIVALENT_ANSWER = "李明：1.2 kg\n张华：-0.5kg\n刘伟：0kg\n李明和刘伟为非负数"


def test_fill_blank_ignores_display_only_circled_answer_numbers():
    """A reference's ①②③ labels must not change the mathematical value."""
    reference = "①1.2 kg；②-0.5 kg；③0 kg"
    answer = "1.2 kg；-0.5 kg；0 kg"

    result = asyncio.run(grade_answer(
        question_type="fill_blank",
        student_answer=answer,
        expected_answer=reference,
    ))

    assert result.is_correct is True
    assert result.match_type == MatchType.NUMERIC_EQUIVALENT
    assert grade_answer_deterministic(
        question_type="fill_blank",
        student_answer=answer,
        expected_answer=reference,
    ) is True


def test_structured_word_problem_accepts_equivalent_labelled_answer():
    result = asyncio.run(grade_answer(
        question_type="free_response",
        student_answer=EQUIVALENT_ANSWER,
        expected_answer=REFERENCE,
    ))

    assert result.is_correct is True
    assert result.match_type == MatchType.STRUCTURED_EQUIVALENT
    assert grade_answer_deterministic(
        question_type="free_response",
        student_answer=EQUIVALENT_ANSWER,
        expected_answer=REFERENCE,
    ) is True


def test_structured_word_problem_still_rejects_wrong_classification():
    assert grade_answer_deterministic(
        question_type="free_response",
        student_answer="李明：1.2kg；张华：-0.5kg；刘伟：0kg；张华和刘伟为非负数",
        expected_answer=REFERENCE,
    ) is False


def test_structured_word_problem_accepts_numeric_nonnegative_classification():
    answer = "李明体重增长1.2kg\n张华体重增长-0.5kg\n刘伟体重增长0kg\n非负数为：1.2kg, 0kg"
    assert grade_answer_deterministic(
        question_type="free_response",
        student_answer=answer,
        expected_answer=REFERENCE,
    ) is True


def test_signed_opposite_explanation_accepts_equivalent_k12_wording():
    reference = "该温度表示为-3℃。零上温度为正，零下温度与它意义相反，两者是相反数。"
    answer = "-3℃。零上温度与零下温度表示相反的量。以0摄氏度为分界点，比0℃小的温度为零下温度，比0℃大的温度为零上温度。"

    result = asyncio.run(grade_answer(
        question_type="free_response",
        student_answer=answer,
        expected_answer=reference,
    ))

    assert result.is_correct is True
    assert result.match_type == MatchType.STRUCTURED_EQUIVALENT


def test_signed_opposite_explanation_is_not_lost_for_short_answer_questions():
    reference = "该温度应表示为-3℃。因为规定零上温度为正，零下温度是与它意义相反的量，应记为负数。"
    answer = "-3℃。零上温度与零下温度表示相反的量。以0摄氏度为分界点，比0℃小的温度为零下温度，比0℃大的温度为零上温度。"

    result = asyncio.run(grade_answer(
        question_type="short_answer",
        student_answer=answer,
        expected_answer=reference,
    ))

    assert result.is_correct is True
    assert result.match_type == MatchType.STRUCTURED_EQUIVALENT


def test_signed_opposite_explanation_rejects_wrong_requested_value():
    assert grade_answer_deterministic(
        question_type="free_response",
        student_answer="3℃。零上温度与零下温度表示相反的量。",
        expected_answer="该温度表示为-3℃。零上温度为正，零下温度与它意义相反，两者是相反数。",
    ) is False


def test_direction_correction_accepts_quoted_unsigned_mistake_and_signed_fix():
    reference = "向右为正，向左走60m应记作-60m。"
    answer = "向左走60m记作60m有错误，正确表示应该为：向左走60m记作-60m"
    result = asyncio.run(grade_answer(
        question_type="short_answer",
        student_answer=answer,
        expected_answer=reference,
    ))
    assert result.is_correct is True
    assert result.match_type == MatchType.STRUCTURED_EQUIVALENT
    assert grade_answer_deterministic(
        question_type="short_answer",
        student_answer=answer,
        expected_answer=reference,
    ) is True


def test_direction_correction_does_not_accept_unsigned_or_wrong_sign_fix():
    reference = "向右为正，向左走60m应记作-60m。"
    assert grade_answer_deterministic(
        question_type="short_answer",
        student_answer="正确表示应该为：向左走60m记作60m",
        expected_answer=reference,
    ) is False
    assert grade_answer_deterministic(
        question_type="short_answer",
        student_answer="正确表示应该为：向左走60m记作+60m",
        expected_answer=reference,
    ) is False


def test_short_answer_accepts_signed_deviation_facts_with_different_wording():
    reference = "比标准质量少30g，记作-30g；偏差-27g表示比标准质量少27g。"
    answer = "-30g\n-27g是指这箱橘子比标准质量少27g"
    assert grade_answer_deterministic(
        question_type="short_answer", student_answer=answer, expected_answer=reference,
    ) is True


def test_measurement_limits_accept_concise_correct_conclusion():
    reference = "最大值为40.05mm，最小值为39.95mm；39.96mm在39.95mm到40.05mm之间，所以合格。"
    answer = "最大值为40.05mm\n最小值为39.95mm\n直径39.96mm的球合格，该直径在最大值与最小值之间"
    result = asyncio.run(grade_answer(
        question_type="short_answer", student_answer=answer, expected_answer=reference,
    ))
    assert result.is_correct is True
    assert result.match_type == MatchType.STRUCTURED_EQUIVALENT


def test_direction_answer_accepts_required_signed_result_without_repeating_stem():
    reference = "向右为正，向左走60m应记作-60m。"
    answer = "-60m\n向右为正数，所以向左走为负数。"
    assert grade_answer_deterministic(
        question_type="short_answer", student_answer=answer, expected_answer=reference,
    ) is True


def test_measurement_limits_still_reject_wrong_limit_or_verdict():
    reference = "最大值为40.05mm，最小值为39.95mm；39.96mm合格。"
    assert grade_answer_deterministic(
        question_type="short_answer",
        student_answer="最大值40.06mm，最小值39.95mm，39.96mm合格",
        expected_answer=reference,
    ) is False
    assert grade_answer_deterministic(
        question_type="short_answer",
        student_answer="最大值40.05mm，最小值39.95mm，39.96mm不合格",
        expected_answer=reference,
    ) is False


def test_number_line_interaction_answer_supports_common_prompt_wording():
    result = asyncio.run(grade_answer(
        question_type="short_answer",
        student_answer="数轴标记：-2、0、3/4\n原点、正方向、单位长度",
        expected_answer="在数轴上正确标出 -2、0、3/4。",
        question_context={"question": "在数轴上标出 -2、0、3/4 这三个数。"},
    ))
    assert result.is_correct is True
    assert result.match_type == MatchType.STRUCTURED_EQUIVALENT
