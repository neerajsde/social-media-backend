import { prisma } from "../../config/prisma.config.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";

export const createMarketPlaceProduct = asyncHandler(async (req, res) => {
  try {
  } catch (error: any) {
    console.log("error is this", error);
    throw new ApiError(400, error.message);
  }
  const userId = req?.session?.userId;
  console.log("req session is this", req.session);
  if (!userId) {
    throw new ApiError(400, "User Id not found.");
  }

  const { title, description, price, category, subCategory, totalQty } =
    req.body;

  if (!title) {
    throw new ApiError(400, "Title required.");
  }

  if (!description) {
    throw new ApiError(400, "Description required.");
  }

  if (!price) {
    throw new ApiError(400, "Price required.");
  }

  if (!category) {
    throw new ApiError(400, "Category required.");
  }

  if (!subCategory) {
    throw new ApiError(400, "Subcategory required.");
  }

  if (totalQty === undefined) {
    throw new ApiError(400, "Total quantity required.");
  }

  //check if the user exist with the provided user id
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });
  console.log("userID", userId);
  console.log("existingUser", existingUser);

  if (!existingUser) {
    throw new ApiError(400, "User not found.");
  }

  //check if the same marketplace product is there with the same data if yes throw an error
  const existingTitle = await prisma.marketPlace.findUnique({
    where: {
      title: title,
    },
  });

  if (existingTitle) {
    throw new ApiError(
      400,
      "Title already exist with the provided title name.",
    );
  }

  const createMarketPlaceProduct = await prisma.marketPlace.create({
    data: {
      title,
      description,
      price,
      totalQty,
      userId,
      subCategory,
      category,
    },
  });
  console.log("createMarketPlaceProduct is this", createMarketPlaceProduct);
  if (!createMarketPlaceProduct) {
    throw new ApiError(
      400,
      "Unable to create a market place product rn. Try again later",
    );
  }

  return res.status(400).json({
    success: false,
    message: "Market place product created successfully.",
  });
});
